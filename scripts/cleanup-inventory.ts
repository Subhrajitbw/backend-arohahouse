import { MedusaContainer } from "@medusajs/framework/types"
import { IInventoryService } from "@medusajs/framework/types"

export default async function cleanupInventory({
  container,
}: {
  container: MedusaContainer
}) {
  const inventoryModuleService = container.resolve<IInventoryService>(
    "inventory"
  )

  const KEEP_SKU = "ARHOSS20002"

  console.log("Fetching all inventory items...")

  const inventoryItems = await inventoryModuleService.listInventoryItems({})

  console.log(`Total inventory items found: ${inventoryItems.length}`)

  const toDelete = inventoryItems
    .filter((item) => item.sku !== KEEP_SKU)
    .map((item) => item.id)

  console.log(`Deleting ${toDelete.length} inventory items...`)

  if (toDelete.length > 0) {
    await inventoryModuleService.deleteInventoryItems(toDelete)
  }

  console.log("✅ Inventory cleanup complete.")
}