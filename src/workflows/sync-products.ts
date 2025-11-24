import { 
  createWorkflow, 
  WorkflowResponse,
  transform 
} from "@medusajs/framework/workflows-sdk"
import { useQueryGraphStep } from "@medusajs/medusa/core-flows"
import { syncProductsStep, SyncProductsStepInput } from "./steps/sync-products"

type SyncProductsWorkflowInput = {
  filters?: Record<string, unknown>
  limit?: number
  offset?: number
}

export const syncProductsWorkflow = createWorkflow(
  "sync-products-to-meilisearch",
  ({ filters = {}, limit = 50, offset = 0 }: SyncProductsWorkflowInput) => {
    // Query products with all required fields
    const { data: products, metadata } = useQueryGraphStep({
      entity: "product",
      fields: [
        "id",
        "title",
        "subtitle",
        "description",
        "handle",
        "thumbnail",
        "is_giftcard",
        "status",
        // Collection fields
        "collection.*",
        // Categories with nested fields
        "categories.*",
        // Tags
        "tags.*",
        // Type
        "type.*",
        // Variants with nested fields
        "variants.*",
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

    // Transform the data to match the expected input shape
    const transformedProducts = transform(
      { products },
      ({ products }) => {
        return products.map((product: any) => ({
          id: product.id,
          title: product.title || "",
          subtitle: product.subtitle || "",
          description: product.description || "",
          handle: product.handle || "",
          thumbnail: product.thumbnail || null,
          is_giftcard: product.is_giftcard || false,
          status: product.status || "draft",
          collection: product.collection
            ? {
                id: product.collection.id,
                title: product.collection.title,
                handle: product.collection.handle,
              }
            : null,
          categories: Array.isArray(product.categories)
            ? product.categories.map((cat: any) => ({
                id: cat.id,
                name: cat.name,
                handle: cat.handle,
              }))
            : [],
          tags: Array.isArray(product.tags)
            ? product.tags.map((tag: any) => ({
                id: tag.id,
                value: tag.value,
              }))
            : [],
          type: product.type
            ? {
                id: product.type.id,
                value: product.type.value,
              }
            : null,
          variants: Array.isArray(product.variants)
            ? product.variants.map((variant: any) => ({
                id: variant.id,
                title: variant.title,
                sku: variant.sku || null,
                barcode: variant.barcode || null,
                ean: variant.ean || null,
                inventory_quantity: variant.inventory_quantity || 0,
              }))
            : [],
        }))
      }
    )

    // Sync to Meilisearch
    const result = syncProductsStep({
      products: transformedProducts,
    })

    return new WorkflowResponse({
      products: transformedProducts,
      metadata,
      syncResult: result,
    })
  }
)
