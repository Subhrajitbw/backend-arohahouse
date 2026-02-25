import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"

import { syncProductTypesStep } from "./steps/sync-product-types"
import { syncCollectionsStep } from "./steps/sync-collections"
import { syncCategoriesStep } from "./steps/sync-categories"
import { syncProductsStep } from "./steps/sync-products"

// --- INPUT TYPES ---
export type SanitySyncTypesWorkflowInput = {
  type_ids?: string[]
}

export type SanitySyncCollectionsWorkflowInput = {
  collection_ids?: string[]
}

export type SanitySyncCategoriesWorkflowInput = {
  category_ids?: string[]
}

export type SanitySyncProductsWorkflowInput = {
  product_ids?: string[]
}

// --- 1. PRODUCT TYPES WORKFLOW ---
export const sanitySyncTypesWorkflow = createWorkflow(
  "sanity-sync-types",
  function (input: SanitySyncTypesWorkflowInput) {
    const result = syncProductTypesStep(input)
    return new WorkflowResponse(result)
  }
)

// --- 2. COLLECTIONS WORKFLOW ---
export const sanitySyncCollectionsWorkflow = createWorkflow(
  "sanity-sync-collections",
  function (input: SanitySyncCollectionsWorkflowInput) {
    const result = syncCollectionsStep(input)
    return new WorkflowResponse(result)
  }
)

// --- 3. CATEGORIES WORKFLOW ---
export const sanitySyncCategoriesWorkflow = createWorkflow(
  "sanity-sync-categories",
  function (input: SanitySyncCategoriesWorkflowInput) {
    const result = syncCategoriesStep(input)
    return new WorkflowResponse(result)
  }
)

// --- 4. PRODUCTS WORKFLOW ---
export const sanitySyncProductsWorkflow = createWorkflow(
  { name: "sanity-sync-products", retentionTime: 10000 },
  function (input: SanitySyncProductsWorkflowInput) {
    const productsResult = syncProductsStep(input)

    return new WorkflowResponse({
      success: true,
      products: productsResult,
    })
  }
)