import fs from "node:fs/promises"
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import sharp from "sharp"

//
// ENV CHECKS
//

const requiredEnv = [
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BASE_URL",
  "R2_RAW_PREFIX",
  "R2_WEBP_PREFIX",
  "MEDUSA_CALLBACK_URL",
  "IMAGE_CONVERSION_TOKEN",
]

const missing = requiredEnv.filter((key) => !process.env[key])
if (missing.length) {
  console.error(`❌ Missing required environment vars: ${missing.join(", ")}`)
  process.exit(1)
}

const {
  R2_ENDPOINT,
  R2_BUCKET,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_PUBLIC_BASE_URL,
  R2_RAW_PREFIX,
  R2_WEBP_PREFIX,
  MEDUSA_PENDING_URL,
  MEDUSA_CALLBACK_URL,
  IMAGE_CONVERSION_TOKEN,
} = process.env

const MAX_TASKS = Number(process.env.MAX_TASKS || 25)
const PENDING_LIMIT = Math.min(Number(process.env.PENDING_LIMIT || 50), 200)
const MAX_PAGES = Number(process.env.MAX_PAGES || 5)
const MAX_WIDTH = Number(process.env.MAX_WIDTH || 2000)
const DELETE_RAW_AFTER_CONVERSION = String(process.env.DELETE_RAW_AFTER_CONVERSION ?? "true") !== "false"


//
// R2 CLIENT
//

const rawPrefix = normalizePrefix(R2_RAW_PREFIX)
const webpPrefix = normalizePrefix(R2_WEBP_PREFIX)
const publicBaseUrl = normalizeBaseUrl(R2_PUBLIC_BASE_URL)

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})


//
// HELPERS
//

function normalizePrefix(value) {
  const t = value.trim().replace(/^\/+/, "")
  return t.endsWith("/") ? t : `${t}/`
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "")
}

const normalizeUrl = (value) => value.split(/[?#]/)[0].trim()

const isSupportedImage = (url) => {
  const lower = url.toLowerCase()
  return /\.(png|jpe?g)$/i.test(lower)
}

const buildPublicUrl = (key) =>
  `${publicBaseUrl}/${key.replace(/^\/+/, "")}`

const keyFromUrl = (url) => {
  const normalized = normalizeUrl(url)
  if (normalized.startsWith(publicBaseUrl)) {
    return normalized.slice(publicBaseUrl.length + 1)
  }
  return normalized.replace(/^\/+/, "")
}

const toWebpKey = (rawKey) => {
  const withoutPrefix = rawKey.startsWith(rawPrefix)
    ? rawKey.slice(rawPrefix.length)
    : rawKey
  const base = withoutPrefix.replace(/\.[^/.]+$/, "")
  return `${webpPrefix}${base}.webp`
}

const toAvifKey = (rawKey) => {
  const withoutPrefix = rawKey.startsWith(rawPrefix)
    ? rawKey.slice(rawPrefix.length)
    : rawKey
  const base = withoutPrefix.replace(/\.[^/.]+$/, "")
  return `${webpPrefix}${base}.avif`
}

const headObjectExists = async (key) => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    return true
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === "NotFound") {
      return false
    }
    throw err
  }
}

const streamToBuffer = async (stream) => {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

const convertImageBuffers = async (buffer) => {
  let pipeline = sharp(buffer).rotate()
  if (MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true })
  }
  const avifBuffer = await pipeline.clone().avif({ quality: 50, effort: 6 }).toBuffer()
  const webpBuffer = await pipeline.clone().webp({ quality: 82, effort: 6 }).toBuffer()
  return { avifBuffer, webpBuffer }
}

const uploadOptimized = async (key, body, contentType) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
}

const removeRawFile = async (key) => {
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}

//
// MEDUSA CALLBACK
//

const callCallback = async (payload) => {
  const response = await fetch(MEDUSA_CALLBACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Image-Conversion-Token": IMAGE_CONVERSION_TOKEN,
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Callback failed: ${response.status} ${text}`)
  }
  return response.json()
}

//
// Dispatch Payload Reader
//

const readDispatchPayload = async () => {
  if (!process.env.GITHUB_EVENT_PATH) return null
  if (process.env.GITHUB_EVENT_NAME !== "repository_dispatch") return null
  const data = await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf-8")
  const obj = JSON.parse(data)
  return obj?.client_payload || null
}

//
// PROCESSING
//

const processImage = async ({ product, originalUrl, isThumbnail }) => {
  const normalized = normalizeUrl(originalUrl)

  if (!normalized.startsWith(`${publicBaseUrl}/${rawPrefix}`)) {
    return { skipped: true }
  }
  if (!isSupportedImage(normalized)) {
    return { skipped: true }
  }

  const rawKey = keyFromUrl(normalized)
  const webpKey = toWebpKey(rawKey)
  const avifKey = toAvifKey(rawKey)
  const optimizedUrl = buildPublicUrl(avifKey)

  const already = await headObjectExists(avifKey)
  if (!already) {
    const rawObj = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: rawKey }))
    const buffer = await streamToBuffer(rawObj.Body)
    const { avifBuffer, webpBuffer } = await convertImageBuffers(buffer)

    await uploadOptimized(avifKey, avifBuffer, "image/avif")
    await uploadOptimized(webpKey, webpBuffer, "image/webp")
  }

  await callCallback({
    product_id: product.id,
    original_url: originalUrl,
    webp_url: optimizedUrl,
    ...(isThumbnail ? { thumbnail_url: optimizedUrl } : {}),
  })

  if (DELETE_RAW_AFTER_CONVERSION) {
    try {
      await removeRawFile(rawKey)
    } catch {}
  }

  return { skipped: false }
}

const processProductImages = async ({ productId, urls, thumbnail }) => {
  let count = 0
  for (const url of urls) {
    if (count >= MAX_TASKS) break
    const isThumb = normalizeUrl(url) === normalizeUrl(thumbnail || "")
    try {
      const result = await processImage({
        product: { id: productId },
        originalUrl: url,
        isThumbnail: isThumb,
      })
      if (!result.skipped) count++
    } catch (err) {
      console.error(`Error converting ${url}`, err)
    }
  }
  return count
}

//
// MAIN
//

const main = async () => {
  const dispatch = await readDispatchPayload()

  if (dispatch?.product_id && Array.isArray(dispatch.images)) {
    await processProductImages({
      productId: dispatch.product_id,
      urls: dispatch.images.filter((u) => typeof u === "string"),
      thumbnail: dispatch.thumbnail,
    })
    return
  }

  if (!MEDUSA_PENDING_URL) return

  let offset = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch(
      new URL(MEDUSA_PENDING_URL + `?limit=${PENDING_LIMIT}&offset=${offset}`)
    )
    if (!response.ok) break

    const { products } = await response.json()
    if (!products?.length) break

    for (const product of products) {
      const candidates = new Set()
      ;(product.images || []).forEach((img) => img?.url && candidates.add(img.url))
      if (product.thumbnail) candidates.add(product.thumbnail)

      await processProductImages({
        productId: product.id,
        urls: Array.from(candidates),
        thumbnail: product.thumbnail,
      })
    }
    offset += products.length
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})