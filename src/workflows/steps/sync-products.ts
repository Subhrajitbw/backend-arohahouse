// import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
// import { MEILISEARCH_MODULE } from "../../modules/meilisearch"
// import MeilisearchModuleService from "../../modules/meilisearch/service"

// export type SyncProductsStepInput = {
//   products: {
//     id: string
//     title: string
//     subtitle?: string
//     description?: string
//     handle: string
//     thumbnail?: string
//     is_giftcard?: boolean
//     status?: string
//     collection?: {
//       id: string
//       title: string
//       handle: string
//     }
//     categories?: {
//       id: string
//       name: string
//       handle: string
//     }[]
//     tags?: {
//       id: string
//       value: string
//     }[]
//     type?: {
//       id: string
//       value: string
//     }
//     variants?: {
//       id: string
//       title: string
//       sku?: string
//       barcode?: string
//       ean?: string
//       inventory_quantity?: number
//     }[]
//   }[]
// }

// export const syncProductsStep = createStep(
//   "sync-products",
//   async ({ products }: SyncProductsStepInput, { container }) => {
//     const meilisearchModuleService = container.resolve<MeilisearchModuleService>(
//       MEILISEARCH_MODULE
//     )
//     const existingProducts = await meilisearchModuleService.retrieveFromIndex(
//       products.map((product) => product.id),
//       "product"
//     )
//     const newProducts = products.filter((product) => !existingProducts.some(
//       (p) => p.id === product.id)
//     )
//     await meilisearchModuleService.indexData(
//       products as unknown as Record<string, unknown>[], 
//       "product"
//     )

//     return new StepResponse(undefined, {
//       newProducts: newProducts.map((product) => product.id),
//       existingProducts,
//     })
//   },
//   async (input, { container }) => {
//     if (!input) {
//       return
//     }

//     const meilisearchModuleService = container.resolve<MeilisearchModuleService>(
//       MEILISEARCH_MODULE
//     )
    
//     if (input.newProducts) {
//       await meilisearchModuleService.deleteFromIndex(
//         input.newProducts,
//         "product"
//       )
//     }

//     if (input.existingProducts) {
//       await meilisearchModuleService.indexData(
//         input.existingProducts,
//         "product"
//       )
//     }
//   }

//   // TODO add compensation
// )

import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { ALGOLIA_MODULE } from "../../modules/algolia"
import AlgoliaModuleService from "../../modules/algolia/service"

export type SyncProductsStepInput = {
    products: {
    id: string
    title: string
    subtitle?: string
    description?: string
    handle: string
    thumbnail?: string
    is_giftcard?: boolean
    status?: string
    collection?: {
      id: string
      title: string
      handle: string
    }
    categories?: {
      id: string
      name: string
      handle: string
    }[]
    tags?: {
      id: string
      value: string
    }[]
    type?: {
      id: string
      value: string
    }
    variants?: {
      id: string
      title: string
      sku?: string
      barcode?: string
      ean?: string
      inventory_quantity?: number
    }[]
  }[]
}

export const syncProductsStep = createStep(
  "sync-products",
  async ({ products }: SyncProductsStepInput, { container }) => {
    const algoliaModuleService: AlgoliaModuleService = container.resolve(ALGOLIA_MODULE)

    const existingProducts = (await algoliaModuleService.retrieveFromIndex(
      products.map((product) => product.id),
      "product"
    )).results.filter(Boolean)
    const newProducts = products.filter(
      (product) => !existingProducts.some((p) => p.objectID === product.id)
    )
    await algoliaModuleService.indexData(
      products as unknown as Record<string, unknown>[], 
      "product"
    )

    return new StepResponse(undefined, {
      newProducts: newProducts.map((product) => product.id),
      existingProducts,
    })
  },
  async (input, { container }) => {
    if (!input) {
      return
    }

    const algoliaModuleService: AlgoliaModuleService = container.resolve(ALGOLIA_MODULE)
    
    if (input.newProducts) {
      await algoliaModuleService.deleteFromIndex(
        input.newProducts,
        "product"
      )
    }

    if (input.existingProducts) {
      await algoliaModuleService.indexData(
        input.existingProducts,
        "product"
      )
    }
  }

  // TODO add compensation
)