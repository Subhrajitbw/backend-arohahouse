import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const TOKEN_HEADER = "x-image-conversion-token"

const getHeaderValue = (value: string | string[] | undefined) => {
  if (!value) {
    return undefined
  }
  return Array.isArray(value) ? value[0] : value
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const expectedToken = process.env.IMAGE_CONVERSION_TOKEN
  if (!expectedToken) {
    res.status(500).json({
      error: "IMAGE_CONVERSION_TOKEN is not configured",
    })
    return
  }

  const providedToken = getHeaderValue(req.headers[TOKEN_HEADER])
  if (!providedToken || providedToken !== expectedToken) {
    res.status(401).json({ error: "Unauthorized" })
    return
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200)
  const offset = Number(req.query.offset) || 0
  const updatedAtGte = req.query.updated_at_gte as string | undefined

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const filters = updatedAtGte ? { updated_at: { $gte: updatedAtGte } } : {}

  const { data: products, metadata } = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "images.*", "updated_at"],
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: {
        updated_at: "DESC",
      },
    },
  })

  res.status(200).json({
    products,
    limit,
    offset,
    count: metadata?.count,
  })
}
