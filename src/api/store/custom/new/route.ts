// src/api/store/products/new/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  
  const limit = Number(req.query.limit) || 12
  const offset = Number(req.query.offset) || 0
  const region_id = req.query.region_id as string
  const currency_code = (req.query.currency_code as string) || "inr" // ✅ Default currency

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "subtitle",
      "handle",
      "thumbnail",
      "description",
      "status",
      "created_at",
      "collection.*",
      "categories.*",
      "tags.*",
      "variants.*",
      "variants.calculated_price.*", // ✅ This requires context
    ],
    filters: {
      status: ["published"],
    },
    pagination: {
      skip: offset,
      take: limit,
      order: {
        created_at: "DESC",
      },
    },
    context: {
      variants: {
        calculated_price: QueryContext({ // ✅ Use QueryContext wrapper
          currency_code, // ✅ REQUIRED
          ...(region_id && { region_id }),
        }),
      },
    },
  })

  res.json({ products })
}
