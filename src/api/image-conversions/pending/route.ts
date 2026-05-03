import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const AUTHENTICATE = false

const TOKEN_HEADER = "x-image-conversion-token"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  
  const expectedToken = process.env.IMAGE_CONVERSION_TOKEN
  const providedToken = req.headers[TOKEN_HEADER]

  if (!expectedToken) {
    logger.error("IMAGE_CONVERSION_TOKEN missing")
    return res.status(500).json({ error: "Token not configured" })
  }

  if (providedToken !== expectedToken) {
    logger.warn("Unauthorized request to image-conversions/pending")
    return res.status(401).json({ error: "Unauthorized" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "images.*"],
  })

  res.json({ products })
}
