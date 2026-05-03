import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { EntityManager } from "@mikro-orm/postgresql"
import { z } from "zod"

export const ImageConversionCallbackSchema = z.object({
  product_id: z.string(),
  original_url: z.string().url(),
  webp_url: z.string().url(),
  avif_url: z.string().url().optional(),
  thumbnail_url: z.string().url().optional(),
})

type ImageConversionCallbackBody = z.infer<typeof ImageConversionCallbackSchema>

export async function POST(
  req: MedusaRequest<ImageConversionCallbackBody>,
  res: MedusaResponse
) {
  const token = req.headers["x-image-conversion-token"]

  if (token !== process.env.IMAGE_CONVERSION_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const { product_id, original_url, webp_url, avif_url, thumbnail_url } = req.body
  const new_url = avif_url || webp_url

  const manager = req.scope.resolve("manager") as EntityManager

  const [result] = await manager.execute(
    `
    UPDATE image
    SET url = $1
    WHERE url = $2
    RETURNING id
    `,
    [new_url, original_url]
  )

  console.log(`Updated image for product ${product_id}: ${original_url} -> ${new_url}. Result:`, result)

  if (thumbnail_url) {
    await manager.execute(
      `
      UPDATE product
      SET thumbnail = $1
      WHERE id = $2
      `,
      [thumbnail_url, product_id]
    )
  }

  res.json({ success: true, updated: Boolean(result) })
}