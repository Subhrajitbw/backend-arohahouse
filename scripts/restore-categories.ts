import {
  IProductModuleService,
  ExecArgs
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import * as fs from "fs";
import * as path from "path";

interface NewCategory {
  name: string;
  handle: string;
  seo_title: string;
  parentHandle: string | null;
}

export default async function restoreCategories({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT);

  const dryRun = process.env.DRY_RUN === 'true';

  logger.info(`Starting restore script${dryRun ? ' (DRY RUN)' : ''}...`);

  // Load new hierarchy
  const hierarchyPath = path.resolve(process.cwd(), "scripts/categories-hierarchy.json");
  if (!fs.existsSync(hierarchyPath)) {
    logger.error(`Hierarchy JSON file not found at ${hierarchyPath}`);
    throw new Error(`Hierarchy JSON file not found at ${hierarchyPath}`);
  }

  const newCategories: NewCategory[] = JSON.parse(fs.readFileSync(hierarchyPath, "utf8"));
  logger.info(`Found ${newCategories.length} categories in hierarchy JSON.`);

  // Load existing categories from database to see what's already there
  const existingCategories = await productModuleService.listProductCategories(
    {},
    { select: ["id", "name", "handle", "parent_category_id", "is_active", "description", "is_internal", "rank", "metadata"], take: 9999 }
  );

  const existingHandleMap = new Map<string, any>();
  for (const cat of existingCategories) {
    existingHandleMap.set(cat.handle, cat);
  }

  // Map handles to new categories for quick lookup
  const newCatMap = new Map<string, NewCategory>();
  for (const cat of newCategories) {
    newCatMap.set(cat.handle, cat);
  }

  // Calculate depths to process parents first
  const depthMap = new Map<string, number>();
  function getDepth(handle: string): number {
    if (depthMap.has(handle)) {
      return depthMap.get(handle)!;
    }
    const cat = newCatMap.get(handle);
    if (!cat || !cat.parentHandle) {
      depthMap.set(handle, 0);
      return 0;
    }
    const depth = 1 + getDepth(cat.parentHandle);
    depthMap.set(handle, depth);
    return depth;
  }

  for (const cat of newCategories) {
    getDepth(cat.handle);
  }

  // Sort categories by depth (ascending) to guarantee parents are created before children
  const sortedCategories = [...newCategories].sort((a, b) => {
    return (depthMap.get(a.handle) || 0) - (depthMap.get(b.handle) || 0);
  });

  // Track handles to IDs mapping dynamically
  const handleToIdMap = new Map<string, string>();
  for (const cat of existingCategories) {
    handleToIdMap.set(cat.handle, cat.id);
  }

  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;

  for (const cat of sortedCategories) {
    const parentHandle = cat.parentHandle;
    let parentId: string | null = null;
    if (parentHandle) {
      parentId = handleToIdMap.get(parentHandle) || null;
      if (!parentId && !dryRun) {
        logger.warn(`Parent category with handle ${parentHandle} not found for child ${cat.handle}.`);
      }
    }

    const existing = existingHandleMap.get(cat.handle);
    const existingMetadata = existing?.metadata || {};

    const payload = {
      name: cat.name,
      description: existing?.description || "",
      is_internal: existing?.is_internal ?? false,
      rank: existing?.rank ?? 0,
      parent_category_id: parentId,
      is_active: true,
      metadata: {
        ...existingMetadata,
        seo_title: cat.seo_title
      }
    };

    if (existing) {
      // UPDATE
      updatedCount++;
      if (!dryRun) {
        try {
          await productModuleService.updateProductCategories(existing.id, payload);
          logger.info(`Updated category: ${cat.name} (${cat.handle})`);
        } catch (e) {
          logger.error(`Failed to update category ${cat.handle}: ${e instanceof Error ? e.message : String(e)}`);
          failedCount++;
          updatedCount--;
        }
      } else {
        logger.info(`[Dry Run] Would update category: ${cat.name} (${cat.handle})`);
      }
    } else {
      // CREATE
      createdCount++;
      if (!dryRun) {
        try {
          const newCat = await productModuleService.createProductCategories({
            ...payload,
            handle: cat.handle,
          });
          handleToIdMap.set(cat.handle, newCat.id);
          logger.info(`Created category: ${cat.name} (${cat.handle})`);
        } catch (e) {
          logger.error(`Failed to create category ${cat.name}: ${e instanceof Error ? e.message : String(e)}`);
          failedCount++;
          createdCount--;
        }
      } else {
        const mockId = `mock_id_${cat.handle}`;
        handleToIdMap.set(cat.handle, mockId);
        logger.info(`[Dry Run] Would create category: ${cat.name} (${cat.handle})`);
      }
    }
  }

  // Deactivate any categories that are no longer part of our target hierarchy
  const activeTargetHandles = new Set(newCategories.map(c => c.handle));
  let deactivatedCount = 0;

  for (const existing of existingCategories) {
    if (!activeTargetHandles.has(existing.handle) && existing.is_active) {
      deactivatedCount++;
      if (!dryRun) {
        try {
          await productModuleService.updateProductCategories(existing.id, { is_active: false });
          logger.info(`Deactivated obsolete category: ${existing.name} (${existing.handle})`);
        } catch (e) {
          logger.error(`Failed to deactivate category ${existing.handle}: ${e instanceof Error ? e.message : String(e)}`);
          deactivatedCount--;
        }
      } else {
        logger.info(`[Dry Run] Would deactivate obsolete category: ${existing.name} (${existing.handle})`);
      }
    }
  }

  logger.info("\n-----------------------------------------------------------");
  logger.info(`Restore run completed successfully${dryRun ? ' (DRY RUN)' : ''}.`);
  logger.info(`Created: ${createdCount}`);
  logger.info(`Updated: ${updatedCount}`);
  logger.info(`Deactivated Obsolete: ${deactivatedCount}`);
  logger.info(`Failed: ${failedCount}`);
  logger.info("-----------------------------------------------------------");
}
