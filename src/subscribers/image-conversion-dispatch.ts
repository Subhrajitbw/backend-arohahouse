import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import type { IProductModuleService } from "@medusajs/framework/types"

const stripQueryAndHash = (value: string): string => {
  const index = value.search(/[?#]/)
  return index === -1 ? value : value.slice(0, index)
}

const normalizeBaseUrl = (value?: string) =>
  value ? value.trim().replace(/\/+$/, "") : undefined

const normalizePrefix = (value?: string) => {
  if (!value) return undefined
  const trimmed = value.trim().replace(/^\/+/, "")
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`
}

const dispatchImageConversion = async (
  productId: string,
  urls: string[],
  thumbnail?: string
) => {
  const githubToken = process.env.GITHUB_DISPATCH_TOKEN
  const githubRepo = process.env.GITHUB_REPO
  if (!githubToken || !githubRepo) {
    console.log(
      "[image-conversion] Missing GITHUB_DISPATCH_TOKEN or GITHUB_REPO; skipping dispatch."
    )
    return
  }

  const apiBase = process.env.GITHUB_API_URL || "https://api.github.com"
  const eventType = process.env.GITHUB_DISPATCH_EVENT || "image_conversion"

  const response = await fetch(`${apiBase}/repos/${githubRepo}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: {
        product_id: productId,
        images: urls,
        thumbnail,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.log(
      `[image-conversion] Dispatch failed ${response.status}: ${text}`
    )
    return
  }

  console.log(
    `[image-conversion] Dispatch queued for product ${productId} with ${urls.length} image(s).`
  )
}

export default async function imageConversionDispatchSubscriber({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const baseUrl =
    normalizeBaseUrl(process.env.FILE_BASE_URL) ||
    normalizeBaseUrl(process.env.R2_PUBLIC_BASE_URL)
  const rawPrefix =
    normalizePrefix(process.env.IMAGE_CONVERSION_RAW_PREFIX) ||
    normalizePrefix(process.env.R2_RAW_PREFIX) ||
    ""

  if (!baseUrl) {
    console.log(
      "[image-conversion] Missing FILE_BASE_URL or R2_PUBLIC_BASE_URL; skipping dispatch."
    )
    return
  }

  const productModuleService = container.resolve<IProductModuleService>(
    Modules.PRODUCT
  )

  const product = await productModuleService.retrieveProduct(data.id, {
    relations: ["images"],
  })

  const rawPrefixUrl = `${baseUrl}/${rawPrefix}`
  const candidates = new Set<string>()

  for (const image of product.images ?? []) {
    const url = image?.url ? stripQueryAndHash(image.url) : undefined
    if (
      url &&
      url.startsWith(rawPrefixUrl) &&
      url.toLowerCase().endsWith(".png")
    ) {
      candidates.add(image.url)
    }
  }

  if (product.thumbnail) {
    const thumb = stripQueryAndHash(product.thumbnail)
    if (thumb.startsWith(rawPrefixUrl) && thumb.toLowerCase().endsWith(".png")) {
      candidates.add(product.thumbnail)
    }
  }

  if (!candidates.size) {
    console.log(
      `[image-conversion] No raw-prefix images for product ${product.id}; skipping dispatch.`
    )
    return
  }

  await dispatchImageConversion(
    product.id,
    Array.from(candidates),
    product.thumbnail
  )
}

export const config: SubscriberConfig = {
  event: "product.updated",
}
