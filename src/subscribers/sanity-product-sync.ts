import type { 
  SubscriberArgs, 
  SubscriberConfig,
} from "@medusajs/framework"
import { 
  sanitySyncProductsWorkflow,
  sanitySyncCategoriesWorkflow,
  sanitySyncCollectionsWorkflow,
  sanitySyncTypesWorkflow
} from "../workflows/sanity-sync"
import { SANITY_MODULE } from "../modules/sanity"
import SanityModuleService from "../modules/sanity/service"

export default async function sanitySyncHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  
  const sanityModule: SanityModuleService = container.resolve(SANITY_MODULE)

  // 1️⃣ HANDLE DELETIONS
  if (name.endsWith(".deleted")) {
    await sanityModule.delete(data.id)
    return
  }

  // 2️⃣ HANDLE CREATE / UPDATE (Dispatch to specific workflows)
  // We use the event name to decide which workflow to run
  if (name.startsWith("product.")) {
    await sanitySyncProductsWorkflow(container).run({
      input: { product_ids: [data.id] },
    })
  } 
  
  else if (name.startsWith("product-category.")) {
    await sanitySyncCategoriesWorkflow(container).run({})
  } 
  
  else if (name.startsWith("product-collection.")) {
    await sanitySyncCollectionsWorkflow(container).run({})
  } 
  
  else if (name.startsWith("product-type.")) {
    await sanitySyncTypesWorkflow(container).run({})
  }
}

export const config: SubscriberConfig = {
  event: [
    // Product Events
    "product.created", "product.updated", "product.deleted",
    // Category Events
    "product-category.created", "product-category.updated", "product-category.deleted",
    // Collection Events
    "product-collection.created", "product-collection.updated", "product-collection.deleted",
    // Type Events
    "product-type.created", "product-type.updated", "product-type.deleted"
  ],
}