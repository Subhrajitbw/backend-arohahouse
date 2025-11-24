// src/api/store/products/most-ordered/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { OrderStatus } from "@medusajs/types"

const serverLog = (...args: any[]) => {
  console.log("[most-ordered-debug]", ...args)
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    serverLog("--- Step 1: Fetching Raw Orders ---")
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    
    const days = Number(req.query.days) || 365 
    const region_id = req.query.region_id as string

    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - days)
    
    const validOrderStatuses: OrderStatus[] = ["pending", "completed", "archived", "requires_action"]

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "status",

        // We depend ONLY on these for product extraction
        "items.variant_id",
        "items.quantity",
        "items.variant.product.id",
        "items.variant.product.title",
        "items.variant.product.thumbnail",
        "items.variant.product.handle",
        "items.variant.product.status",
      ],
      filters: {
        status: validOrderStatuses,
        created_at: { $gte: startDate.toISOString() },
        ...(region_id && { region_id }),
      },
    })
    
    if (!orders || orders.length === 0) {
      return res.json({ products: [], note: "No orders found." })
    }

    serverLog(`Fetched ${orders.length} orders.`)

    // ---------------------------------------------------
    // Step 2: Aggregate product counts
    // ---------------------------------------------------
    const productSales = new Map<string, {
      id: string
      title: string
      handle: string
      thumbnail: string
      total_ordered: number
    }>()

    for (const order of orders) {
      for (const item of order.items || []) {
        const product = item?.variant?.product
        if (!product?.id) {
          serverLog("Missing product in item:", item)
          continue
        }

        // quantity fallback: assume 1 if missing/invalid
        const qtyRaw = item.quantity
        const qty = (qtyRaw === null || qtyRaw === undefined) ? 1 : Number(qtyRaw || 1)

        const existing = productSales.get(product.id) || {
          id: product.id,
          title: product.title,
          handle: product.handle,
          thumbnail: product.thumbnail,
          total_ordered: 0,
        }

        existing.total_ordered += qty
        productSales.set(product.id, existing)
      }
    }

    // No products found in orders
    if (productSales.size === 0) {
      return res.json({
        products: [],
        note: "Orders exist, but none contain variant.product data.",
      })
    }

    // ---------------------------------------------------
    // Step 3: Convert Map → Array and Sort
    // ---------------------------------------------------
    const products = Array.from(productSales.values())
      .sort((a, b) => b.total_ordered - a.total_ordered)

    // Optional: apply `limit`
    const limit = Number(req.query.limit) || 10
    const result = products.slice(0, limit)

    return res.json({
      count: result.length,
      products: result,
    })

  } catch (error) {
    serverLog("--- Endpoint ERROR ---", error)
    return res.status(500).json({
      error: "internal_server_error",
      message: error.message,
    })
  }
}
