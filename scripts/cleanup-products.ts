import { MedusaContainer } from "@medusajs/framework/types"
import { IProductModuleService } from "@medusajs/framework/types"

export default async function cleanupProducts({
  container,
}: {
  container: MedusaContainer
}) {
  const productModuleService = container.resolve<IProductModuleService>(
    "product"
  )

  const KEEP_ID = "prod_01KHDBWRMMYZP0VPXGEJTG6CWG"

  console.log("Fetching all products...")

  const products = await productModuleService.listProducts({})

  console.log(`Total products found: ${products.length}`)

  const toDelete = products
    .map((p) => p.id)
    .filter((id) => id !== KEEP_ID)

  console.log(`Deleting ${toDelete.length} products...`)

  if (toDelete.length > 0) {
    await productModuleService.deleteProducts(toDelete)
  }

  console.log("✅ Cleanup complete.")
}