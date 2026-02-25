import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  ContainerRegistrationKeys,
  promiseAll,
} from "@medusajs/framework/utils"
import SanityModuleService from "../../../modules/sanity/service"
import { SANITY_MODULE } from "../../../modules/sanity"

type UpsertRecord = {
  before: { _id?: string } | null
  after: { _id: string } | null
}

export type SyncTypesInput = {
  type_ids?: string[]
}

export const syncProductTypesStep = createStep(
  "sanity-sync-types",
  async (input: SyncTypesInput, { container }) => {
    const sanityModule: SanityModuleService =
      container.resolve(SANITY_MODULE)

    const query = container.resolve(
      ContainerRegistrationKeys.QUERY
    )

    const upsertMap: UpsertRecord[] = []

    // Skip if no IDs provided
    if (!input.type_ids || input.type_ids.length === 0) {
      return new StepResponse({ total: 0 }, [])
    }

    const filters = { id: input.type_ids }

    try {
      const { data: types = [] } = await query.graph({
        entity: "product_type",
        fields: ["id", "value"],
        filters,
      })

      if (!types.length) {
        return new StepResponse({ total: 0 }, [])
      }

      await promiseAll(
        types.map(async (t: any) => {
          const docId = t.id

          const existing = await sanityModule
            .retrieve(docId)
            .catch(() => null)

          const sanityPayload: any = {
            _id: docId,
            _type: "productType",
            medusaId: t.id,
            title: t.value,
          }

          // ---- CMS PRESERVATION ----
          if (existing) {
            if (existing.seo)
              sanityPayload.seo = existing.seo

            if (existing.description)
              sanityPayload.description =
                existing.description
          }

          const after =
            await sanityModule.upsertSyncDocument(
              "productType",
              sanityPayload
            )

          upsertMap.push({
            before: existing ? { _id: docId } : null,
            after: after ?? null,
          })

          return after
        })
      )

      return new StepResponse(
        { total: types.length },
        upsertMap
      )
    } catch (e: any) {
      throw new Error(`Type Sync error: ${e?.message ?? e}`)
    }
  },

  async (
    upsertMap: UpsertRecord[] | undefined | null,
    { container }
  ) => {
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