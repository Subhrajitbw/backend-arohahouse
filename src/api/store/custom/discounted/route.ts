// src/api/store/custom/discounted/route.ts
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Simple discounted-products route (PRICE-LIST only) with price_set_id fallback
 *
 * Returns products that have a lower price because of an active 'sale' Price List.
 *
 * Query params:
 *  - currency_code (optional, default "usd")
 *  - limit (optional)
 *  - offset (optional)
 *
 * NOTE: Fallback scans variants to map price_set_id -> variant. Consider caching
 *       or a precomputed index for large catalogs.
 */

type AnyPrice = Record<string, any>

const serverLog = (...args: any[]) => {
    // eslint-disable-next-line no-console
    console.log("[discounted-price-list]", ...args)
  
}

/* helpers to cope with varying shapes from Medusa responses */
const getVariantId = (p?: AnyPrice): string | undefined =>
  p?.variant_id || p?.variantId || p?.variant?.id || undefined

const getPriceSetId = (p?: AnyPrice): string | undefined =>
  p?.price_set_id || p?.priceSetId || p?.price_set?.id || undefined

const getCurrencyFromPrice = (p?: AnyPrice): string | undefined =>
  (p?.currency_code || p?.currency || p?.currencyCode || "")?.toString().toLowerCase() || undefined

const normalizeGraphArray = <T = any>(maybe: T[] | { data?: T[] } | undefined): T[] => {
  if (!maybe) return []
  if (Array.isArray(maybe)) return maybe
  if ((maybe as any).data && Array.isArray((maybe as any).data)) return (maybe as any).data
  return []
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const pricingService = req.scope.resolve(Modules.PRICING)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const limit = Number(req.query.limit) || 12
    const offset = Number(req.query.offset) || 0
    const currency_code = ((req.query.currency_code as string) || "inr").toLowerCase()

    const debug: any = {
      currency_code,
      price_lists_found: 0,
      total_price_entries: 0,
      price_entries_with_variant_id: 0,
      price_entries_with_price_set_id: 0,
      variant_ids_found: [],
      price_set_ids_found: [],
      variants_checked: 0,
      matched_products: 0,
    }

    // 1) load active sale price lists
    const priceLists = await pricingService.listPriceLists({ status: ["active"] })
    const salePriceLists = (priceLists || []).filter((pl: any) => pl.type === "sale")
    debug.price_lists_found = salePriceLists.length
    serverLog("Found sale price lists:", salePriceLists.map((p: any) => ({ id: p.id, title: p.title })))

    if (salePriceLists.length === 0) {
      return res.json({ products: [], count: 0, offset, limit, debug })
    }

    // 2) collect price entries (all sale price lists)
    const allEntries: AnyPrice[] = []
    for (const pl of salePriceLists) {
      const entries = await pricingService.listPrices({ price_list_id: [pl.id] })
      debug.total_price_entries += (entries || []).length
      for (const e of entries || []) {
        allEntries.push(e as AnyPrice)
        if (getVariantId(e as AnyPrice)) debug.price_entries_with_variant_id += 1
        if (getPriceSetId(e as AnyPrice)) debug.price_entries_with_price_set_id += 1
      }
    }

    // 3) prefer entries that have variant_id (fast path)
    const variantIds = new Set<string>()
    for (const e of allEntries) {
      const vid = getVariantId(e)
      if (vid) variantIds.add(vid)
    }
    debug.variant_ids_found = Array.from(variantIds)

    const discountedProductsMap = new Map<string, any>()

    // FAST PATH: variant_id-based matching
    if (variantIds.size > 0) {
      const variantResult = await query.graph({
        entity: "product_variant",
        fields: ["id", "title", "product_id", "prices.*"],
        filters: { id: Array.from(variantIds) },
      })
      const variantArray = normalizeGraphArray<any>(variantResult)
      debug.variants_checked = variantArray.length
      const variantMap = new Map<string, any>(variantArray.map((v: any) => [v.id, v]))

      // For each price entry that references a variant, compare sale vs base
      for (const entry of allEntries) {
        const vid = getVariantId(entry)
        if (!vid) continue
        const variant = variantMap.get(vid)
        if (!variant) continue

        // base price is a money_amount without price_list_id for the requested currency
        const base = (variant.prices || []).find(
          (p: any) => !p.price_list_id && String((p.currency_code || "")).toLowerCase() === currency_code
        )
        if (!base) continue

        // sale price entry matching this variant & currency
        const saleEntry = allEntries.find(
          (ae) =>
            getVariantId(ae) === vid &&
            String((getCurrencyFromPrice(ae) || "")).toLowerCase() === currency_code
        )
        if (!saleEntry) continue

        const baseAmount = Number(base.amount)
        const saleAmount = Number(saleEntry.amount)

        if (Number.isFinite(baseAmount) && Number.isFinite(saleAmount) && saleAmount < baseAmount) {
          const productId = variant.product_id
          const discountPct = Math.round(((baseAmount - saleAmount) / baseAmount) * 100)

          // fetch minimal product info once per product
          if (!discountedProductsMap.has(productId)) {
            const prodResult = await query.graph({
              entity: "product",
              fields: ["id", "title", "handle", "thumbnail", "variants.*"],
              filters: { id: productId },
            })
            const prodArr = normalizeGraphArray<any>(prodResult)
            const product = Array.isArray(prodArr) ? prodArr[0] : null
            if (!product) continue

            discountedProductsMap.set(productId, {
              id: product.id,
              title: product.title,
              handle: product.handle,
              thumbnail: product.thumbnail,
              discount_percentage: discountPct,
              original_price: baseAmount,
              sale_price: saleAmount,
              currency_code,
            })
            debug.matched_products += 1
          } else {
            const existing = discountedProductsMap.get(productId)
            if (saleAmount < Number(existing.sale_price)) {
              existing.sale_price = saleAmount
              existing.original_price = baseAmount
              existing.discount_percentage = discountPct
            }
          }
        }
      }
    }

    // FALLBACK: price_set_id based mapping (when no variant_id references exist)
    if (discountedProductsMap.size === 0) {
      // collect all distinct price_set_ids from entries
      const priceSetIds = new Set<string>()
      for (const e of allEntries) {
        const psid = getPriceSetId(e)
        if (psid) priceSetIds.add(psid)
      }
      debug.price_set_ids_found = Array.from(priceSetIds)

      if (priceSetIds.size > 0) {
        // WARNING: This fetch scans variants to find prices that reference a price_set_id.
        // For large catalogs, prefer a background job or DB index to build price_set->variant mapping.
        const variantResultAll = await query.graph({
          entity: "product_variant",
          fields: ["id", "title", "product_id", "prices.*"],
          // no filters: we need to inspect variant.prices.* to find matching price_set_ids
        })
        const variantArrayAll = normalizeGraphArray<any>(variantResultAll)
        debug.variants_checked = variantArrayAll.length

        // build map: price_set_id -> [variant]
        const priceSetToVariants = new Map<string, any[]>()
        for (const v of variantArrayAll) {
          const prices = v.prices || []
          for (const pr of prices) {
            const psid = (pr as any)?.price_set_id || (pr as any)?.priceSetId || undefined
            if (!psid) continue
            if (priceSetIds.has(psid)) {
              if (!priceSetToVariants.has(psid)) priceSetToVariants.set(psid, [])
              priceSetToVariants.get(psid)!.push(v)
            }
          }
        }

        // Now iterate allEntries and match by price_set_id -> variant(s)
        for (const entry of allEntries) {
          const psid = getPriceSetId(entry)
          if (!psid) continue
          const variantsForPs = priceSetToVariants.get(psid) || []
          for (const variant of variantsForPs) {
            // find base price on variant
            const base = (variant.prices || []).find(
              (p: any) => !p.price_list_id && String((p.currency_code || "")).toLowerCase() === currency_code
            )
            if (!base) continue

            const baseAmount = Number(base.amount)
            const saleAmount = Number(entry.amount)
            if (!(Number.isFinite(baseAmount) && Number.isFinite(saleAmount))) continue
            if (saleAmount >= baseAmount) continue

            const productId = variant.product_id
            const discountPct = Math.round(((baseAmount - saleAmount) / baseAmount) * 100)

            if (!discountedProductsMap.has(productId)) {
              const prodResult = await query.graph({
                entity: "product",
                fields: ["id", "title", "handle", "thumbnail", "variants.*"],
                filters: { id: productId },
              })
              const prodArr = normalizeGraphArray<any>(prodResult)
              const product = Array.isArray(prodArr) ? prodArr[0] : null
              if (!product) continue

              discountedProductsMap.set(productId, {
                id: product.id,
                title: product.title,
                handle: product.handle,
                thumbnail: product.thumbnail,
                discount_percentage: discountPct,
                original_price: baseAmount,
                sale_price: saleAmount,
                currency_code,
              })
              debug.matched_products += 1
            } else {
              const existing = discountedProductsMap.get(productId)
              if (saleAmount < Number(existing.sale_price)) {
                existing.sale_price = saleAmount
                existing.original_price = baseAmount
                existing.discount_percentage = discountPct
              }
            }
          }
        }
      }
    }

    // Prepare paginated response
    const discountedProducts = Array.from(discountedProductsMap.values())
    const total = discountedProducts.length
    const paginated = discountedProducts.slice(offset, offset + limit)

    return res.json({
      products: paginated,
      count: total,
      offset,
      limit,
      debug,
    })
  } catch (err) {
    serverLog("Error in discounted route:", err)
    return res.status(500).json({ error: "internal_error", message: (err as any)?.message || String(err) })
  }
}
