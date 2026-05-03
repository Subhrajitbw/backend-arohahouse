import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { IProductModuleService } from "@medusajs/framework/types"
import { z } from "zod"

export const AUTHENTICATE = false

export const ImageConversionCallbackSchema = z.object({
  product_id: z.string().min(1),
  original_url: z.string().min(1),
  webp_url: z.string().min(1),
  avif_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
})

type ImageConversionCallbackInput = z.infer<typeof ImageConversionCallbackSchema>

const stripQueryAndHash = (value: string): string => {
  const index = value.search(/[?#]/)
  return index === -1 ? value : value.slice(0, index)
}

export async function POST(
  req: MedusaRequest<ImageConversionCallbackInput>,
  res: MedusaResponse
): Promise<void> {
  const token = req.headers["x-image-conversion-token"]

  if (token !== process.env.IMAGE_CONVERSION_TOKEN) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const { product_id, original_url, webp_url, avif_url, thumbnail_url } = req.body
  const new_url = avif_url || webp_url

  const productModuleService = req.scope.resolve<IProductModuleService>(
    Modules.PRODUCT
  )

  try {
    // 1. Fetch product with its current images
    const product = await productModuleService.retrieveProduct(product_id, {
      relations: ["images"],
    })

    const images = product.images ?? []
    const normalizedOriginal = stripQueryAndHash(original_url)

    // 2. Identify which images need updating
    let hasChanges = false
    const updatedImages = images.map((image) => {
      if (stripQueryAndHash(image.url) === normalizedOriginal) {
        hasChanges = true
        return {
          id: image.id, // Keep the same image ID but update the URL
          url: new_url,
        }
      }
      return { id: image.id, url: image.url }
    })

    // 3. Check thumbnail
    let updatedThumbnail: string | undefined
    if (product.thumbnail && stripQueryAndHash(product.thumbnail) === normalizedOriginal) {
      updatedThumbnail = thumbnail_url || new_url
      hasChanges = true
    }

    if (!hasChanges) {
       res.status(200).json({ success: true, updated: false, message: "No matching URLs found to update" })
       return
    }

    // 4. Perform the update via the Service
    await productModuleService.updateProducts(product_id, {
      images: updatedImages,
      thumbnail: updatedThumbnail,
    })

    console.log(`Successfully updated product ${product_id} via ProductModuleService`)
    res.status(200).json({ success: true, updated: true })

  } catch (error) {
    console.error(`Error in image conversion callback for product ${product_id}:`, error)
    res.status(500).json({ error: "Internal server error during update" })
  }
}
