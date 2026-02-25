import { 
  createWorkflow, 
  WorkflowResponse,
  transform 
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"

import { syncProductsStep } from "./sanity-sync/steps/sync-products"
import { syncCategoriesStep } from "./sanity-sync/steps/sync-categories"
import { syncCollectionsStep } from "./sanity-sync/steps/sync-collections"
import { syncProductTypesStep } from "./sanity-sync/steps/sync-product-types"

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export const syncProductsWorkflow = createWorkflow(
  "sync-products-to-sanity",
  ({ filters = {}, limit = 50, offset = 0 }: SyncProductsWorkflowInput) => {

    const { data: products, metadata } = useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "title",
        "handle",
        "thumbnail",
        "status",
        "collection.id",
        "collection.title",
        "collection.handle",
        "categories.id",
        "categories.name",
        "categories.handle",
        "categories.parent_category_id", // CRITICAL FOR HIERARCHY
        "type.id",
        "type.value",
      ],
      filters: {
        status: ["published", "proposed"],
        ...filters,
      },
      pagination: {
        skip: offset,
        take: limit,
      },
    })

    const syncData = transform(
      { products },
      ({ products }) => {
        const seenTypeIds = new Set()
        const seenCollectionIds = new Set()
        const seenCategoryIds = new Set()

        const types: any[] = []
        const collections: any[] = []
        const categories: any[] = []

        products.forEach((product: any) => {
          if (product.type && !seenTypeIds.has(product.type.id)) {
            seenTypeIds.add(product.type.id)
            types.push({ id: product.type.id, value: product.type.value })
          }

          if (product.collection && !seenCollectionIds.has(product.collection.id)) {
            seenCollectionIds.add(product.collection.id)
            collections.push({
              id: product.collection.id,
              title: product.collection.title,
              handle: product.collection.handle,
            })
          }

          product.categories?.forEach((cat: any) => {
            if (!seenCategoryIds.has(cat.id)) {
              seenCategoryIds.add(cat.id)
              categories.push({ 
                id: cat.id, 
                name: cat.name, 
                handle: cat.handle,
                parent_id: cat.parent_category_id 
              })
            }
          })
        })

        return {
          products: products.map(p => ({ id: p.id })),
          types,
          collections,
          categories
        }
      }
    )

    const typeIds = transform({ syncData }, (data) => data.syncData.types.map(t => t.id))
    const collectionIds = transform({ syncData }, (data) => data.syncData.collections.map(c => c.id))
    const categoryIds = transform({ syncData }, (data) => data.syncData.categories.map(c => c.id))
    const productIds = transform({ syncData }, (data) => data.syncData.products.map(p => p.id))

    const typesSyncResult = syncProductTypesStep({ type_ids: typeIds })
    const collectionsSyncResult = syncCollectionsStep({ collection_ids: collectionIds })
    const categoriesSyncResult = syncCategoriesStep({ category_ids: categoryIds })
    const productsSyncResult = syncProductsStep({ product_ids: productIds })

    return new WorkflowResponse({
      products: syncData.products,
      metadata,
      syncResults: {
        products: productsSyncResult,
        types: typesSyncResult,
        collections: collectionsSyncResult,
        categories: categoriesSyncResult,
      },
    })
  }
)