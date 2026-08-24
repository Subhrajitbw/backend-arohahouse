import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import {
  ExecArgs,
  IProductModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";

interface ExcelRow {
  fileName: string;
  styleNo: string;
  title: string;
  subtitle: string;
  handle: string;
  mrp: number;
  width: string;
  depth: string;
  height: string;
  keyUsps: string;
  valuePositioning: string;
  aiContext: string;
  bestFor: string;
  categoryPath: string[];
}

export default async function updateFromExcel({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Initializing Excel Product Catalog Synchronization...");

  // 1. Scan and read all category details from database for lookup & hierarchical cache
  const categories = await productModuleService.listProductCategories(
    {},
    { select: ["id", "name", "handle", "parent_category_id"], take: 9999 }
  );

  const categoryCache = new Map<string, string>(); // Key: "[parent_id || 'root']:[name.toLowerCase()]", Value: category_id
  const categoryNameMap = new Map<string, string>();
  const categoryHandleMap = new Map<string, string>();

  for (const cat of categories) {
    const parentKey = cat.parent_category_id || "root";
    categoryCache.set(`${parentKey}:${cat.name.toLowerCase()}`, cat.id);
    categoryNameMap.set(cat.name.toLowerCase(), cat.id);
    categoryHandleMap.set(cat.handle.toLowerCase(), cat.id);
  }

  // Helper to slugify category names
  function slugify(text: string): string {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  }

  // Recursive category creator if paths in Excel are missing
  async function getOrCreateCategory(pathNames: string[]): Promise<string | null> {
    let parentId: string | null = null;
    
    for (const name of pathNames) {
      if (!name) continue;
      const cleanName = name.trim();
      const parentKey = parentId || "root";
      const cacheKey = `${parentKey}:${cleanName.toLowerCase()}`;
      
      if (categoryCache.has(cacheKey)) {
        parentId = categoryCache.get(cacheKey)!;
      } else {
        // Check globally by name/handle to avoid duplicate nodes
        let existingId = categoryNameMap.get(cleanName.toLowerCase()) || categoryHandleMap.get(slugify(cleanName));
        
        if (existingId) {
          parentId = existingId;
          categoryCache.set(cacheKey, existingId);
        } else {
          // Create the missing category node
          const baseHandle = slugify(cleanName);
          let uniqueHandle = baseHandle;
          let counter = 1;
          while (categoryHandleMap.has(uniqueHandle.toLowerCase())) {
            uniqueHandle = `${baseHandle}-${counter++}`;
          }
          
          try {
            const [created] = await productModuleService.createProductCategories([{
              name: cleanName,
              handle: uniqueHandle,
              parent_category_id: parentId,
              is_active: true,
              is_internal: false
            }]);
            
            logger.info(`Created missing category: "${cleanName}" (handle: "${uniqueHandle}") under parent: ${parentId}`);
            
            parentId = created.id;
            categoryCache.set(cacheKey, created.id);
            categoryNameMap.set(cleanName.toLowerCase(), created.id);
            categoryHandleMap.set(uniqueHandle.toLowerCase(), created.id);
          } catch (err: any) {
            logger.error(`Failed to create category "${cleanName}": ${err.message}`);
            return null;
          }
        }
      }
    }
    
    return parentId;
  }

  // 2. Parse Excel files
  const excelFiles = [
    "Baby Walker.xlsx",
    "Coffee Table.xlsx",
    "Console Table.xlsx",
    "Baby Storage Shelf.xlsx",
    "Baby Storage.xlsx",
    "Step Stool.xlsx",
    "Single Seater Sofa.xlsx",
    "Baby Rocker.xlsx",
    "Baby Cot.xlsx",
    "3 Seater Sofa Set.xlsx",
    "Chair.xlsx",
    "Side Table.xlsx"
  ];

  const excelRows: ExcelRow[] = [];

  for (const fileName of excelFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) {
      logger.warn(`Excel file not found, skipping: ${fileName}`);
      continue;
    }

    try {
      const workbook = XLSX.readFile(filePath);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any[]>(firstSheet, { header: 1 });
      if (data.length < 2) continue;

      // Find header index (headers are usually on row index 1)
      let headerRowIndex = 0;
      for (let r = 0; r < Math.min(data.length, 3); r++) {
        if (data[r] && data[r].includes("Title") && (data[r].includes("STYLE NO") || data[r].includes("Style No"))) {
          headerRowIndex = r;
          break;
        }
      }

      const header = data[headerRowIndex].map(h => String(h || "").trim());
      
      const styleNoIdx = header.findIndex(h => h.toUpperCase() === "STYLE NO");
      const titleIdx = header.indexOf("Title");
      const subtitleIdx = header.indexOf("Subtitle");
      const handleIdx = header.indexOf("Handle");
      const mrpIdx = header.indexOf("MRP");
      
      // Dimension indexes
      const wIdx = header.findIndex(h => h.toLowerCase().startsWith("width"));
      const dIdx = header.findIndex(h => h.toLowerCase().startsWith("depth"));
      const hIdx = header.findIndex(h => h.toLowerCase().startsWith("height"));

      // Specs indexes
      const keyUspsIdx = header.indexOf("Key USPs");
      const valPositioningIdx = header.indexOf("Value Positioning");
      const aiContextIdx = header.indexOf("AI Context");
      const bestForIdx = header.indexOf("Best For");

      // Category path indexes
      const catIdx = header.indexOf("CAT");
      const subCat1Idx = header.indexOf("SubCat 1") !== -1 ? header.indexOf("SubCat 1") : header.indexOf("SubCat");
      const subCat2Idx = header.indexOf("SubCat 2");
      const subcatGeneralIdx = header.indexOf("SUBCAT");

      for (let r = headerRowIndex + 1; r < data.length; r++) {
        const row = data[r];
        if (!row || row.length === 0) continue;

        const title = row[titleIdx];
        const styleNo = row[styleNoIdx];
        if (!title && !styleNo) continue;

        const handle = row[handleIdx] || "";
        const subtitle = row[subtitleIdx] || "";
        const mrpRaw = row[mrpIdx];
        const mrp = mrpRaw ? parseFloat(String(mrpRaw).replace(/[^\d.]/g, "")) : 0;

        const width = wIdx !== -1 ? String(row[wIdx] || "").trim() : "";
        const depth = dIdx !== -1 ? String(row[dIdx] || "").trim() : "";
        const height = hIdx !== -1 ? String(row[hIdx] || "").trim() : "";

        const keyUsps = keyUspsIdx !== -1 ? String(row[keyUspsIdx] || "").trim() : "";
        const valuePositioning = valPositioningIdx !== -1 ? String(row[valPositioningIdx] || "").trim() : "";
        const aiContext = aiContextIdx !== -1 ? String(row[aiContextIdx] || "").trim() : "";
        const bestFor = bestForIdx !== -1 ? String(row[bestForIdx] || "").trim() : "";

        // Build category path
        const categoryPath: string[] = [];
        if (catIdx !== -1 && row[catIdx]) categoryPath.push(String(row[catIdx]));
        if (subCat1Idx !== -1 && row[subCat1Idx]) categoryPath.push(String(row[subCat1Idx]));
        if (subCat2Idx !== -1 && row[subCat2Idx]) categoryPath.push(String(row[subCat2Idx]));
        if (subcatGeneralIdx !== -1 && row[subcatGeneralIdx]) categoryPath.push(String(row[subcatGeneralIdx]));

        excelRows.push({
          fileName,
          styleNo: String(styleNo || "").trim(),
          title: String(title || "").trim(),
          subtitle: String(subtitle || "").trim(),
          handle: String(handle || "").trim(),
          mrp,
          width,
          depth,
          height,
          keyUsps,
          valuePositioning,
          aiContext,
          bestFor,
          categoryPath: categoryPath.map(c => c.trim()).filter(Boolean)
        });
      }
    } catch (err: any) {
      logger.error(`Error parsing Excel ${fileName}: ${err.message}`);
    }
  }

  logger.info(`Parsed ${excelRows.length} product records from Excel files.`);

  // 3. Fetch all database products to match
  const dbProducts = await productModuleService.listProducts(
    {},
    { select: ["id", "title", "handle", "subtitle", "metadata"], relations: ["variants", "categories"], take: 9999 }
  );
  logger.info(`Loaded ${dbProducts.length} active products from Medusa DB.`);

  let matchCount = 0;
  let updatePayloads: any[] = [];

  for (const row of excelRows) {
    // Find matching database product
    let matchedProduct = dbProducts.find(p => p.handle && row.handle && p.handle.toLowerCase() === row.handle.toLowerCase());
    if (!matchedProduct) {
      matchedProduct = dbProducts.find(p => p.title && row.title && p.title.toLowerCase() === row.title.toLowerCase());
    }

    if (!matchedProduct) {
      logger.warn(`No match found for Excel product: "${row.title}" (handle: "${row.handle}") in ${row.fileName}`);
      continue;
    }

    matchCount++;

    // Resolve or create category path
    let leafCategoryId: string | null = null;
    if (row.categoryPath.length > 0) {
      leafCategoryId = await getOrCreateCategory(row.categoryPath);
    }

    // Merge metadata
    const existingMetadata: any = matchedProduct.metadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      dimensions: {
        width: row.width || existingMetadata?.dimensions?.width || "",
        depth: row.depth || existingMetadata?.dimensions?.depth || "",
        height: row.height || existingMetadata?.dimensions?.height || "",
        unit: "inch"
      },
      key_usps: row.keyUsps || existingMetadata?.key_usps || "",
      value_positioning: row.valuePositioning || existingMetadata?.value_positioning || "",
      best_for: row.bestFor || existingMetadata?.best_for || "",
      ai_context: row.aiContext || existingMetadata?.ai_context || ""
    };

    // Prepare variant updates
    const variantsPayload: any[] = [];
    if (matchedProduct.variants && matchedProduct.variants.length > 0) {
      const dbVariants = matchedProduct.variants;
      
      if (dbVariants.length === 1) {
        // Single variant: direct update to styleNo and mrp
        const v = dbVariants[0];
        variantsPayload.push({
          id: v.id,
          sku: row.styleNo || v.sku,
          prices: row.mrp > 0 ? [{ amount: row.mrp, currency_code: "inr" }] : undefined
        });
      } else {
        // Multiple variants: set SKU based on variant option values or title and apply base MRP
        for (const v of dbVariants) {
          const suffix = slugify(v.title || (v as any).name || "");
          const newSku = suffix ? `${row.styleNo}-${suffix.toUpperCase()}` : v.sku;
          
          variantsPayload.push({
            id: v.id,
            sku: newSku,
            prices: row.mrp > 0 ? [{ amount: row.mrp, currency_code: "inr" }] : undefined
          });
        }
      }
    }

    // Link category
    const categoryIds = matchedProduct.categories?.map(c => c.id) || [];
    if (leafCategoryId && !categoryIds.includes(leafCategoryId)) {
      categoryIds.push(leafCategoryId);
    }

    updatePayloads.push({
      id: matchedProduct.id,
      subtitle: row.subtitle || matchedProduct.subtitle || undefined,
      metadata: updatedMetadata,
      category_ids: categoryIds.length > 0 ? categoryIds : undefined,
      variants: variantsPayload.length > 0 ? variantsPayload : undefined
    });
  }

  logger.info(`Successfully matched ${matchCount} products. Committing updates to Medusa...`);

  // 4. Commit updates in batches of 25 using updateProductsWorkflow
  const batchSize = 25;
  let successUpdates = 0;

  for (let i = 0; i < updatePayloads.length; i += batchSize) {
    const batch = updatePayloads.slice(i, i + batchSize);
    logger.info(`Updating batch ${Math.floor(i / batchSize) + 1} (${batch.length} products)...`);
    
    try {
      await updateProductsWorkflow(container).run({
        input: {
          products: batch
        }
      });
      successUpdates += batch.length;
      logger.info(`Batch ${Math.floor(i / batchSize) + 1} updated successfully.`);
    } catch (err: any) {
      logger.error(`Batch ${Math.floor(i / batchSize) + 1} failed: ${err.message}`);
      // Retry product-by-product on failure
      for (const pPayload of batch) {
        try {
          await updateProductsWorkflow(container).run({
            input: {
              products: [pPayload]
            }
          });
          successUpdates++;
        } catch (singleErr: any) {
          logger.error(`Failed to update product ID ${pPayload.id}: ${singleErr.message}`);
        }
      }
    }
  }

  logger.info(`Excel synchronization complete! Successfully updated ${successUpdates} products.`);
}
