import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
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
const WEBP_QUALITY = Number(process.env.WEBP_QUALITY || 80)
const MAX_WIDTH = process.env.MAX_WIDTH ? Number(process.env.MAX_WIDTH) : undefined

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

const stripQueryAndHash = (value) => {
  const index = value.search(/[?#]/)
  return index === -1 ? value : value.slice(0, index)
}

const normalizeUrl = (value) => stripQueryAndHash(value).trim()

const isSupportedImage = (urlOrKey) => {
  const lower = urlOrKey.toLowerCase()
  return lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")
}

const buildPublicUrl = (key) => `${publicBaseUrl}/${key.replace(/^\/+/, "")}`

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

const streamToBuffer = async (stream) => {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const headObject = async (key) => {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
      })
    )
    return true
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) {
      return false
    }
    if (error?.name === "NotFound") {
      return false
    }
    throw error
  }
}

const convertToWebp = async (buffer) => {
  let pipeline = sharp(buffer)
  if (MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true })
  }
  return pipeline.webp({ quality: WEBP_QUALITY }).toBuffer()
}

const uploadWebp = async (key, body) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/webp",
    })
  )
}

const fetchPendingProducts = async (offset) => {
  console.log(
    `MEDUSA_PENDING_URL="${MEDUSA_PENDING_URL}" (length ${MEDUSA_PENDING_URL?.length ?? 0})`
  )
  const url = new URL(MEDUSA_PENDING_URL)
  url.searchParams.set("limit", String(PENDING_LIMIT))
  url.searchParams.set("offset", String(offset))
  if (UPDATED_AT_GTE) {
    url.searchParams.set("updated_at_gte", UPDATED_AT_GTE)
  }

  const response = await fetch(url, {
    headers: {
      "X-Image-Conversion-Token": IMAGE_CONVERSION_TOKEN,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to fetch pending products: ${response.status} ${text}`)
  }

  return response.json()
}

const readDispatchPayload = async () => {
  if (!process.env.GITHUB_EVENT_PATH) {
    return null
  }
  if (process.env.GITHUB_EVENT_NAME !== "repository_dispatch") {
    return null
  }
  const fs = await import("node:fs/promises")
  const raw = await fs.readFile(process.env.GITHUB_EVENT_PATH, "utf-8")
  const payload = JSON.parse(raw)
  return payload?.client_payload || null
}

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

const processImage = async ({ product, originalUrl, isThumbnail }) => {
  const normalizedUrl = normalizeUrl(originalUrl)
  if (!normalizedUrl.startsWith(`${publicBaseUrl}/${rawPrefix}`)) {
    return { skipped: true, reason: "not_raw_prefix" }
  }

  if (!isSupportedImage(normalizedUrl)) {
    return { skipped: true, reason: "unsupported_extension" }
  }

  const rawKey = keyFromUrl(normalizedUrl)
  const webpKey = toWebpKey(rawKey)
  const webpUrl = buildPublicUrl(webpKey)

  const exists = await headObject(webpKey)
  if (!exists) {
    const rawObject = await s3.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key: rawKey,
      })
    )
    const buffer = await streamToBuffer(rawObject.Body)
    const webpBuffer = await convertToWebp(buffer)
    await uploadWebp(webpKey, webpBuffer)
  }

  await callCallback({
    product_id: product.id,
    original_url: originalUrl,
    webp_url: webpUrl,
    ...(isThumbnail ? { thumbnail_url: webpUrl } : {}),
  })

  return { skipped: false, webpUrl }
}

const processProductImages = async ({ productId, urls, thumbnail }) => {
  let processed = 0

  for (const url of urls) {
    if (processed >= MAX_TASKS) {
      console.log(`Reached MAX_TASKS=${MAX_TASKS}, stopping.`)
      break
    }
    const isThumbnail = normalizeUrl(url) === normalizeUrl(thumbnail || "")
    try {
      const result = await processImage({
        product: { id: productId, thumbnail },
        originalUrl: url,
        isThumbnail,
      })
      if (!result.skipped) {
        processed += 1
        console.log(`Processed product ${productId}: ${url} -> ${result.webpUrl}`)
      }
    } catch (error) {
      console.error(`Failed to process ${url}:`, error)
    }
  }

  return processed
}

const main = async () => {
  console.log(
    `GITHUB_EVENT_NAME="${process.env.GITHUB_EVENT_NAME ?? ""}"`
  )
  const dispatchPayload = await readDispatchPayload()
  if (dispatchPayload?.product_id && Array.isArray(dispatchPayload.images)) {
    console.log(
      `Repository dispatch payload received for product ${dispatchPayload.product_id} with ${dispatchPayload.images.length} image(s).`
    )
    console.log(
      `Dispatch image URLs: ${dispatchPayload.images.join(", ")}`
    )
    const urls = dispatchPayload.images.filter((url) => typeof url === "string")
    const processed = await processProductImages({
      productId: dispatchPayload.product_id,
      urls,
      thumbnail: dispatchPayload.thumbnail,
    })
    console.log(`Done. Converted ${processed} image(s).`)
    return
  }

  if (!MEDUSA_PENDING_URL) {
    console.log(
      "No repository_dispatch payload and MEDUSA_PENDING_URL is missing. Exiting."
    )
    return
  }

  let processed = 0
  let offset = 0

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const { products } = await fetchPendingProducts(offset)
    if (!products || products.length === 0) {
      break
    }

    for (const product of products) {
      const candidates = new Set()
      const images = product.images || []

      for (const image of images) {
        if (image?.url) {
          candidates.add(image.url)
        }
      }

      if (product.thumbnail) {
        candidates.add(product.thumbnail)
      }

      const productProcessed = await processProductImages({
        productId: product.id,
        urls: Array.from(candidates),
        thumbnail: product.thumbnail,
      })
      processed += productProcessed
    }

    offset += products.length
  }

  console.log(`Done. Converted ${processed} image(s).`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

function normalizePrefix(value) {
  const trimmed = value.trim().replace(/^\/+/, "")
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

function normalizeBaseUrl(value) {
  return value.trim().replace(/\/+$/, "")
}
