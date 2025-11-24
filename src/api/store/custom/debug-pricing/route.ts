// src/api/store/custom/debug-prices/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, QueryContext, Modules } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const pricingModuleService = req.scope.resolve(Modules.PRICING)
  
  const currency_code = "usd"

  // Get price lists
  const allPriceLists = await pricingModuleService.listPriceLists({
    status: ["active"],
  })

  const priceLists = (allPriceLists || []).filter((pl: any) => pl.type === "sale")

  // Prepare price list ids for query context
  const priceListIds = priceLists.length > 0 ? priceLists.map((pl: any) => pl.id) : undefined

  // Get one product to inspect
  const resp = (await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "variants.*",
      "variants.calculated_price.*",
    ],
    filters: { status: ["published"] },
    pagination: { take: 1 },
    context: {
      variants: {
        calculated_price: QueryContext({
          currency_code,
          ...(priceListIds ? { price_list_id: priceListIds } : {}),
        }),
      },
    },
  })) as any

  const products = resp.data as any[]
  const product = products?.[0] as any
  const variant = product?.variants?.[0] as any
  const price = variant?.calculated_price as any

  res.json({
    price_lists: priceLists.map((pl: any) => ({
      id: pl.id,
      title: pl.title,
      type: pl.type,
      status: pl.status,
    })),
    sample_product: {
      id: product?.id,
      title: product?.title,
      variant_id: variant?.id,
    },
    price_details: {
      calculated_amount: price?.calculated_amount,
      original_amount: price?.original_amount,
      currency_code: price?.currency_code,
      price_list_id: price?.price_list_id,
      price_list_type: price?.price_list_type,
      is_calculated_price_price_list: price?.is_calculated_price_price_list,
      is_original_price_price_list: price?.is_original_price_price_list,
    },
  })
}
