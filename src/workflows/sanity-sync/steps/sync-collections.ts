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

export type SyncCollectionsInput = {
  collection_ids?: string[]
}

export const syncCollectionsStep = createStep(
  "sanity-sync-collections",
  async (input: SyncCollectionsInput, { container }) => {
    const sanityModule: SanityModuleService = container.resolve(SANITY_MODULE)
    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const upsertMap: UpsertRecord[] = []

    // Skip if no collection IDs
    if (!input.collection_ids || input.collection_ids.length === 0) {
      return new StepResponse({ total: 0 }, [])
    }

    const filters = { id: input.collection_ids }

    try {
      // Fetch just the targeted collections
      const { data: collections = [] } = await query.graph({
        entity: "product_collection",
        fields: ["id", "title", "handle"],
        filters,
      })

      if (!collections.length) {
        return new StepResponse({ total: 0 }, [])
      }

      // Sync each collection in parallel
      await promiseAll(
        collections.map(async (col: any) => {
          // Use Medusa ID as Sanity document ID
          const docId = col.id

          // Try to retrieve existing doc with same ID
          const existing = await sanityModule.retrieve(docId).catch(() => null)

          const sanityPayload: any = {
            _id: docId,
            _type: "collection",
            medusaId: col.id,
            title: col.title,
            handle: col.handle,
          }

          // Preserve CMS fields if they exist
          if (existing) {
            if (existing.heroImageR2) sanityPayload.heroImageR2 = existing.heroImageR2
            if (existing.shortDescription) sanityPayload.shortDescription = existing.shortDescription
            if (existing.content) sanityPayload.content = existing.content
            if (existing.seo) sanityPayload.seo = existing.seo
          }

          const after = await sanityModule.upsertSyncDocument(
            "collection",
            sanityPayload
          )

          upsertMap.push({ 
            before: existing ? { _id: docId } : null, 
            after: after ?? null 
          })

          return after
        })
      )

      return new StepResponse({ total: collections.length }, upsertMap)
    } catch (e: any) {
      throw new Error(`Collection Sync error: ${e?.message ?? e}`)
    }
  },
  async (upsertMap, { container }) => {
    if (!upsertMap?.length) return
    const sanityModule: SanityModuleService = container.resolve(SANITY_MODULE)

    await promiseAll(
      upsertMap.map(({ before, after }) => {
        // If created new but later rollback happens, delete
        if (after && (!before || !before._id)) {
          return sanityModule.delete(after._id)
        }
        return Promise.resolve()
      })
    )
  }
)