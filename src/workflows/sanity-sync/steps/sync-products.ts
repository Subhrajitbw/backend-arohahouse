import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  promiseAll,
} from "@medusajs/framework/utils"
import SanityModuleService from "../../../modules/sanity/service"
import { SANITY_MODULE } from "../../../modules/sanity"

export type SyncStepInput = {
  product_ids?: string[]
}

type UpsertRecord = {
  before: { _id?: string } | null
  after: { _id: string } | null
}

export const syncProductsStep = createStep(
  "sync-step",
  async (input: SyncStepInput, { container }) => {
    const sanityModule: SanityModuleService = container.resolve(SANITY_MODULE)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    let total = 0
    const upsertMap: UpsertRecord[] = []

    const batchSize = 200
    let hasMore = true
    let offset = 0

    const filters = input.product_ids ? { id: input.product_ids } : {}

    try {
      while (hasMore) {
        const {
          data: products = [],
          metadata: { count = 0 } = {},
        } = await query.graph({
          entity: "product",
          fields: [
            "id",
            "title",
            "handle",
            "thumbnail",
            "images.id",
            "images.url",
            "type.*", // FIXED: Added .* to expand the relation
          ],
          filters,
          pagination: {
            skip: offset,
            take: batchSize,
            order: { id: "ASC" },
          },
        })

        if (!products.length) {
          hasMore = false
          break
        }

        await promiseAll(
          products.map(async (prod: any) => {
            const existing = await sanityModule.retrieve(prod.id).catch(() => null)

            const sanityPayload: any = {
              _id: prod.id,
              _type: "product",
              medusaId: prod.id,
              title: prod.title,
              handle: prod.handle,
              // FIXED: Accessing the value from the expanded type relation
              medusaType: prod.type?.value || null, 
              thumbnailR2: prod.thumbnail ? { url: prod.thumbnail } : null,
              galleryR2: prod.images?.map((img: any) => ({
                _key: img.id,
                url: img.url,
              })) || [],
            }
            
            if (existing) {
              if (existing.shortDescription) sanityPayload.shortDescription = existing.shortDescription
              if (existing.richDescription) sanityPayload.richDescription = existing.richDescription
              if (existing.features) sanityPayload.features = existing.features
              if (existing.specifications) sanityPayload.specifications = existing.specifications
              if (existing.extraSections) sanityPayload.extraSections = existing.extraSections
              
              if (existing.relatedProducts) sanityPayload.relatedProducts = existing.relatedProducts
              if (existing.upsellProducts) sanityPayload.upsellProducts = existing.upsellProducts
              if (existing.crosssellProducts) sanityPayload.crosssellProducts = existing.crosssellProducts
            }

            const after = await sanityModule.upsertSyncDocument("product", sanityPayload)

            upsertMap.push({
              before: { _id: prod.id },
              after: after ?? null,
            })

            return after
          })
        )

        offset += batchSize
        hasMore = offset < count
        total += products.length
      }
    } catch (e: any) {
      throw new Error(`Sync error: ${e?.message ?? e}`)
    }

    return new StepResponse({ total }, upsertMap)
  },

  async (upsertMap: UpsertRecord[] | undefined | null, { container }) => {
    if (!upsertMap?.length) return
    const sanityModule: SanityModuleService = container.resolve(SANITY_MODULE)

    await promiseAll(
      upsertMap.map(({ before, after }) => {
        if (after && (!before || !before._id)) {
          return sanityModule.delete(after._id)
        }
        return Promise.resolve()
      })
    )
  }
)
