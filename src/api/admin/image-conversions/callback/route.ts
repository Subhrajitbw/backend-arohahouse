import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { IProductModuleService } from "@medusajs/framework/types"
import { z } from "zod"

export const ImageConversionCallbackSchema = z.object({
  product_id: z.string().min(1),
  original_url: z.string().min(1),
  webp_url: z.string().min(1),
  thumbnail_url: z.string().min(1).optional(),
})

type ImageConversionCallbackInput = z.infer<
  typeof ImageConversionCallbackSchema
>

const TOKEN_HEADER = "x-image-conversion-token"

const stripQueryAndHash = (value: string): string => {
  const index = value.search(/[?#]/)
  return index === -1 ? value : value.slice(0, index)
}

export async function POST(
  req: MedusaRequest<ImageConversionCallbackInput>,
  res: MedusaResponse
): Promise<void> {
  const expectedTokenRaw = process.env.IMAGE_CONVERSION_TOKEN
  const logger = req.scope.resolve("logger")
  if (!expectedTokenRaw) {
    res.status(500).json({
      error: "IMAGE_CONVERSION_TOKEN is not configured",
    })
    return
  }

  const expectedToken = expectedTokenRaw.trim()
  logger.info(
    `[image-conversion] token length=${expectedToken.length}`
  )

  const headerValue = req.headers[TOKEN_HEADER]
  const providedTokenRaw = Array.isArray(headerValue)
    ? headerValue[0]
    : headerValue
  const providedToken = providedTokenRaw?.trim()

  logger.info(
    `[image-conversion] provided token length=${providedToken?.length ?? 0}`
  )

  if (!providedToken || providedToken !== expectedToken) {
    logger.info(
      `[image-conversion] token match=false`
    )
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const { product_id, original_url, webp_url, thumbnail_url } =
    req.validatedBody

  const productModuleService = req.scope.resolve<IProductModuleService>(
    Modules.PRODUCT
  )

  const product = await productModuleService.retrieveProduct(product_id, {
    relations: ["images"],
  })

  const images = product.images ?? []
  const normalizedOriginal = stripQueryAndHash(original_url)
  const normalizedWebp = stripQueryAndHash(webp_url)
  const normalizedThumbnail = thumbnail_url
    ? stripQueryAndHash(thumbnail_url)
    : undefined

  const imageUpdates = images
    .filter((image) => stripQueryAndHash(image.url) === normalizedOriginal)
    .map((image) => ({ id: image.id, url: webp_url }))

  let updatedThumbnail: string | undefined
  if (
    product.thumbnail &&
    stripQueryAndHash(product.thumbnail) === normalizedOriginal
  ) {
    updatedThumbnail = thumbnail_url ?? webp_url
  }

  const alreadyUpdated =
    images.some(
      (image) => stripQueryAndHash(image.url) === normalizedWebp
    ) ||
    (product.thumbnail &&
      stripQueryAndHash(product.thumbnail) === normalizedWebp) ||
    (normalizedThumbnail
      ? product.thumbnail &&
        stripQueryAndHash(product.thumbnail) === normalizedThumbnail
      : false)

  if (imageUpdates.length === 0 && !updatedThumbnail) {
    if (alreadyUpdated) {
      res.status(200).json({
        status: "already_updated",
        product_id,
      })
      return
    }

    res.status(404).json({
      status: "no_match",
      product_id,
    })
    return
  }

  await productModuleService.updateProducts(product_id, {
    images: imageUpdates.length ? imageUpdates : undefined,
    thumbnail: updatedThumbnail,
  })

  res.status(200).json({
    status: "updated",
    product_id,
    updated_images: imageUpdates.length,
    thumbnail_updated: Boolean(updatedThumbnail),
  })
}
