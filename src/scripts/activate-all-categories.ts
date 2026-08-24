import {
  ExecArgs,
  IProductModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function activateAllCategories({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Fetching all product categories...");
  const categories = await productModuleService.listProductCategories(
    {},
    { select: ["id", "name", "handle", "is_active"], take: 9999 }
  );

  logger.info(`Found ${categories.length} total categories in database.`);
  
  const inactiveCategories = categories.filter(c => !c.is_active);
  logger.info(`Number of inactive categories: ${inactiveCategories.length}`);

  if (categories.length === 0) {
    logger.info("No categories found to activate.");
    return;
  }

  // Update all categories to be active
  logger.info("Activating all categories...");
  
  const categoryIds = categories.map(c => c.id);
  logger.info(`Activating all ${categoryIds.length} categories...`);
  await productModuleService.updateProductCategories({ id: categoryIds }, { is_active: true });

  logger.info("Successfully activated all product categories!");
}
