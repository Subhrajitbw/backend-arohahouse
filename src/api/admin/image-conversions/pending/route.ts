import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const AUTHENTICATE = false   // IMPORTANT

const TOKEN_HEADER = "x-image-conversion-token"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  console.log("ROUTE HIT")

  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info("Image conversion route started")

  const expectedToken = process.env.IMAGE_CONVERSION_TOKEN
  const providedToken = req.headers[TOKEN_HEADER]

  logger.info("Expected token exists: " + Boolean(expectedToken))
  logger.info("Provided token: " + providedToken)

  if (!expectedToken) {
    logger.error("IMAGE_CONVERSION_TOKEN missing")
    return res.status(500).json({ error: "Token not configured" })
  }

  if (providedToken !== expectedToken) {
    logger.warn("Unauthorized request")
    return res.status(401).json({ error: "Unauthorized" })
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "images.*"],
  })

  logger.info(`Products fetched: ${products.length}`)

  res.json({ products })
}