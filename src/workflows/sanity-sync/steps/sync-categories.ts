import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  promiseAll,
} from "@medusajs/framework/utils"
import SanityModuleService from "../../../modules/sanity/service"
import { SANITY_MODULE } from "../../../modules/sanity"

export type SyncCategoriesInput = {
  category_ids?: string[]
}

type UpsertRecord = {
  before: { _id?: string } | null
  after: { _id: string } | null
}

export const syncCategoriesStep = createStep(
  "sanity-sync-categories",
  async (input: SyncCategoriesInput, { container }) => {
    const sanityModule: SanityModuleService =
      container.resolve(SANITY_MODULE)

    const query = container.resolve(
      ContainerRegistrationKeys.QUERY
    )

    const upsertMap: UpsertRecord[] = []

    const filters = input.category_ids
      ? { id: input.category_ids }
      : {}

    // Fetch categories
    const { data: categories = [] } = await query.graph({
      entity: "product_category",
      fields: ["id", "name", "handle", "parent_category_id"],
      filters,
    })

    if (!categories.length) {
      return new StepResponse({ total: 0 }, [])
    }

    // ---- Hierarchy depth calculation (same as before) ----
    const getDepth = (cat: any, all: any[]): number => {
      let depth = 0
      let current = cat

      while (current.parent_category_id) {
        depth++
        const parent = all.find(
          (p) => p.id === current.parent_category_id
        )
        if (!parent) break
        current = parent
      }

      return depth
    }

    const categoriesWithDepth = categories.map((cat) => ({
      ...cat,
      depth: getDepth(cat, categories),
    }))

    const maxDepth = Math.max(
      ...categoriesWithDepth.map((c) => c.depth),
      0
    )

    try {
      for (let i = 0; i <= maxDepth; i++) {
        const layer = categoriesWithDepth.filter(
          (c) => c.depth === i
        )

        await promiseAll(
          layer.map(async (cat) => {
            const docId = cat.id

            const existing = await sanityModule
              .retrieve(docId)
              .catch(() => null)

            const sanityPayload: any = {
              _id: docId,
              _type: "category",
              medusaId: cat.id,
              title: cat.name,
              handle: cat.handle,
            }

            if (cat.parent_category_id) {
              sanityPayload.parent = {
                _type: "reference",
                _ref: cat.parent_category_id,
              }
            }

            // ---- CMS PRESERVATION (Same philosophy as product) ----
            if (existing) {
              if (existing.heroImageR2)
                sanityPayload.heroImageR2 = existing.heroImageR2

              if (existing.shortDescription)
                sanityPayload.shortDescription = existing.shortDescription

              if (existing.description)
                sanityPayload.description = existing.description

              if (existing.seo)
                sanityPayload.seo = existing.seo
            }

            const after =
              await sanityModule.upsertSyncDocument(
                "category",
                sanityPayload
              )

            upsertMap.push({
              before: existing ? { _id: docId } : null,
              after: after ?? null,
            })

            return after
          })
        )
      }
    } catch (e: any) {
      throw new Error(
        `Category Sync error: ${e?.message ?? e}`
      )
    }

    return new StepResponse(
      { total: categories.length },
      upsertMap
    )
  },

  async (upsertMap: UpsertRecord[] | undefined | null, { container }) => {
    if (!upsertMap?.length) return

    const sanityModule: SanityModuleService =
      container.resolve(SANITY_MODULE)

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