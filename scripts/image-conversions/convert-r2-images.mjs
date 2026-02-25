import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import sharp from "sharp"

const requiredEnv = [
  "R2_ENDPOINT",
  "R2_BUCKET",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PUBLIC_BASE_URL",
  "R2_RAW_PREFIX",
  "R2_WEBP_PREFIX",
  "MEDUSA_PENDING_URL",
  "MEDUSA_CALLBACK_URL",
  "IMAGE_CONVERSION_TOKEN",
]

const hasDispatchPayload = Boolean(process.env.GITHUB_EVENT_PATH)
const requiredForPolling = requiredEnv.filter((key) => key !== "MEDUSA_PENDING_URL")
const missing = (hasDispatchPayload ? requiredForPolling : requiredEnv).filter(
  (key) => !process.env[key]
)
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`)
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
const UPDATED_AT_GTE = process.env.UPDATED_AT_GTE
const MAX_WIDTH = Number(process.env.MAX_WIDTH || 2000)
const DELETE_RAW_AFTER_CONVERSION =
  String(process.env.DELETE_RAW_AFTER_CONVERSION ?? "true").toLowerCase() !== "false"

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

// strip query and hash from URL
const normalizeUrl = (value) =>
  value.split(/[?#]/)[0].trim()

// Valid source image formats
const isSupportedImage = (urlOrKey) => {
  const lower = urlOrKey.toLowerCase()
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
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
    await s3.send(
      new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key })
    )
    return true
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404 || error?.name === "NotFound") {
      return false
    }
    throw error
  }
}

const streamToBuffer = async (stream) => {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
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

const deleteRawFile = async (key) => {
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}

const processImage = async ({ product, originalUrl, isThumbnail }) => {
  const normalizedUrl = normalizeUrl(originalUrl)
  if (!normalizedUrl.startsWith(`${publicBaseUrl}/${rawPrefix}`)) {
    return { skipped: true, reason: "not raw prefix" }
  }
  if (!isSupportedImage(normalizedUrl)) {
    return { skipped: true, reason: "unsupported extension" }
  }

  const rawKey = keyFromUrl(normalizedUrl)
  const webpKey = toWebpKey(rawKey)
  const avifKey = toAvifKey(rawKey)

  const optimizedUrl = buildPublicUrl(avifKey)

  const already = await headObjectExists(avifKey)
  if (!already) {
    const rawObj = await s3.send(
      new GetObjectCommand({ Bucket: R2_BUCKET, Key: rawKey })
    )
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
      await deleteRawFile(rawKey)
    } catch (error) {
      console.error(`Failed to delete raw file ${rawKey}:`, error)
    }
  }

  return { skipped: false, optimizedUrl }
}

const processProductImages = async ({ productId, urls, thumbnail }) => {
  let processed = 0
  for (const url of urls) {
    if (processed >= MAX_TASKS) break
    const isThumb = normalizeUrl(url) === normalizeUrl(thumbnail || "")
    try {
      const result = await processImage({
        product: { id: productId, thumbnail },
        originalUrl: url,
        isThumbnail: isThumb,
      })
      if (!result.skipped) processed++
    } catch (error) {
      console.error(`Error processing ${url}`, error)
    }
  }
  return processed
}

const main = async () => {
  const dispatchPayload = await readDispatchPayload()
  if (dispatchPayload?.product_id && Array.isArray(dispatchPayload.images)) {
    const urls = dispatchPayload.images.filter((u) => typeof u === "string")
    await processProductImages({
      productId: dispatchPayload.product_id,
      urls,
      thumbnail: dispatchPayload.thumbnail,
    })
    return
  }

  if (!MEDUSA_PENDING_URL) return

  let offset = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const { products } = await fetchPendingProducts(offset)
    if (!products?.length) break
    for (const product of products) {
      const urls = new Set()
      ;(product.images || []).forEach((img) => img?.url && urls.add(img.url))
      if (product.thumbnail) urls.add(product.thumbnail)
      await processProductImages({
        productId: product.id,
        urls: Array.from(urls),
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

function normalizePrefix(value) {
  const trimmed = value.trim().replace(/^\/+/, "")
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "")
}