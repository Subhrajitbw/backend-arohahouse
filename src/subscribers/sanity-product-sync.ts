import type { 
  SubscriberArgs, 
  SubscriberConfig,
} from "@medusajs/framework"
import { 
  sanitySyncProductsWorkflow,
} from "../workflows/sanity-sync-products"
import { SANITY_MODULE } from "../modules/sanity"
import SanityModuleService from "../modules/sanity/service"

export default async function productSyncHandler({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  
  // CASE 1: Handle DELETE
  if (name === "product.deleted") {
    const sanityModule: SanityModuleService = container.resolve(SANITY_MODULE)
    await sanityModule.delete(data.id)
    return
  }

  // CASE 2: Handle CREATE / UPDATE
  // Trigger the workflow to fetch data and upsert to Sanity
  await sanitySyncProductsWorkflow(container).run({
    input: {
      product_ids: [data.id],
    },
  })
}

export const config: SubscriberConfig = {
  // Listen to ALL three events
  event: ["product.created", "product.updated", "product.deleted"],
}
