import {
  ExecArgs,
  IProductModuleService,
} from "@medusajs/framework/types";
import { Modules, ProductStatus } from "@medusajs/framework/utils";
import { createProductsWorkflow } from "@medusajs/medusa/core-flows";
import * as fs from "fs";
import * as path from "path";

interface CsvVariant {
  title: string;
  sku: string;
  manage_inventory: boolean;
  options: Record<string, string>;
  prices: Array<{ amount: number; currency_code: string }>;
}

interface CsvProduct {
  id?: string;
  handle: string;
  title: string;
  description: string;
  status: ProductStatus;
  thumbnail: string;
  images: Array<{ url: string }>;
  category_ids: string[];
  options: Array<{ title: string; values: string[] }>;
  variants: CsvVariant[];
  medusaType?: string;
  collectionHandle?: string;
}

function parseCSV(text: string): string[][] {
  const p: string[][] = [];
  let r: string[] = [];
  let f = "";
  let insideQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (insideQuote && next === '"') {
        f += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (c === ',' && !insideQuote) {
      r.push(f);
      f = "";
    } else if ((c === '\r' || c === '\n') && !insideQuote) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      r.push(f);
      p.push(r);
      r = [];
      f = "";
    } else {
      f += c;
    }
  }
  if (r.length > 0 || f !== "") {
    r.push(f);
    p.push(r);
  }
  return p;
}

function blockContentToPlainText(blocks: any[]): string {
  if (!blocks || !Array.isArray(blocks)) return "";
  return blocks
    .map(block => {
      if (block._type !== 'block' || !block.children) return '';
      return block.children.map((child: any) => child.text).join('');
    })
    .join('\n\n');
}

export default async function restoreProducts({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Starting Medusa Products restoration from data.ndjson and CSVs...");

  // 1. Fetch all category details from database to construct handle/name lookup maps
  const categories = await productModuleService.listProductCategories(
    {},
    { select: ["id", "name", "handle"], take: 9999 }
  );
  const categoryHandleMap = new Map<string, string>(categories.map(c => [c.handle.toLowerCase(), c.id]));
  const categoryNameMap = new Map<string, string>(categories.map(c => [c.name.toLowerCase(), c.id]));

  // Helper function to find category ID by name/handle
  function findCategoryId(input: string): string | null {
    if (!input) return null;
    const normalized = input.trim().toLowerCase();
    if (categoryHandleMap.has(normalized)) return categoryHandleMap.get(normalized)!;
    if (categoryNameMap.has(normalized)) return categoryNameMap.get(normalized)!;
    
    // Check if the input is a full path (e.g. "Furniture > Tables > Coffee Table")
    if (input.includes(">")) {
      const parts = input.split(">").map(p => p.trim().toLowerCase());
      const lastPart = parts[parts.length - 1];
      if (categoryHandleMap.has(lastPart)) return categoryHandleMap.get(lastPart)!;
      if (categoryNameMap.has(lastPart)) return categoryNameMap.get(lastPart)!;
    }
    return null;
  }

  // 2. Parse and load all CSV products (sofa, coffee table, side table)
  const csvFiles = [
    "medusa_side_IMPORT_CREATE_FINAL.csv",
    "medusa_coffee_tables_import_FINAL.csv",
    "medusa_3_seater_sofa_import_FINAL.csv"
  ];

  const csvProductsMap = new Map<string, CsvProduct>();

  for (const fileName of csvFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;

    logger.info(`Parsing CSV file: ${fileName}`);
    const csvContent = fs.readFileSync(filePath, "utf8");
    const rows = parseCSV(csvContent);
    if (rows.length < 2) continue;

    const header = rows[0].map(h => h.trim().toLowerCase());
    
    const idIdx = header.indexOf("product id");
    const handleIdx = header.indexOf("product handle");
    const titleIdx = header.indexOf("product title");
    const descIdx = header.indexOf("product description");
    const statusIdx = header.indexOf("product status");
    const thumbIdx = header.indexOf("product thumbnail");
    const img1Idx = header.indexOf("product image 1");
    const img2Idx = header.indexOf("product image 2");
    const img3Idx = header.indexOf("product image 3");
    
    const cat1Idx = header.indexOf("product category 1");
    const cat2Idx = header.indexOf("product category 2");
    const cat3Idx = header.indexOf("product category 3");
    
    const vIdIdx = header.indexOf("variant id");
    const vTitleIdx = header.indexOf("variant title");
    const vSkuIdx = header.indexOf("variant sku");
    const vManageInventoryIdx = header.indexOf("variant manage inventory");
    
    // Try both INR formats
    let vPriceIdx = header.indexOf("variant price inr");
    if (vPriceIdx === -1) vPriceIdx = header.indexOf("variant price [inr]");

    // Try finding option name columns dynamically (e.g. Variant Option 1 Name, Variant Option 1 Value)
    const optionCols: Array<{ nameIdx: number; valIdx: number }> = [];
    for (let optNum = 1; optNum <= 5; optNum++) {
      const nameColName = `variant option ${optNum} name`;
      const valColName = `variant option ${optNum} value`;
      const nIdx = header.indexOf(nameColName);
      const vIdx = header.indexOf(valColName);
      if (nIdx !== -1 && vIdx !== -1) {
        optionCols.push({ nameIdx: nIdx, valIdx: vIdx });
      }
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 3) continue;

      const handle = row[handleIdx];
      if (!handle) continue;

      const title = row[titleIdx];
      const desc = row[descIdx] || "";
      const statusRaw = row[statusIdx]?.toLowerCase();
      const status = statusRaw === "published" ? ProductStatus.PUBLISHED : ProductStatus.DRAFT;
      const thumbnail = row[thumbIdx] || row[img1Idx] || "";

      // Gather images
      const images: Array<{ url: string }> = [];
      [img1Idx, img2Idx, img3Idx].forEach(idx => {
        if (idx !== -1 && row[idx]) {
          images.push({ url: row[idx] });
        }
      });
      if (images.length === 0 && thumbnail) {
        images.push({ url: thumbnail });
      }

      // Gather categories
      const category_ids: string[] = [];
      [cat1Idx, cat2Idx, cat3Idx].forEach(idx => {
        if (idx !== -1 && row[idx]) {
          const val = row[idx].trim();
          // If it is a direct pcat ID
          if (val.startsWith("pcat_")) {
            category_ids.push(val);
          } else {
            const mappedId = findCategoryId(val);
            if (mappedId) category_ids.push(mappedId);
          }
        }
      });

      // Gather variant details
      const vTitle = row[vTitleIdx] || "Default";
      const vSku = row[vSkuIdx] || `SKU-${handle.toUpperCase()}`;
      const vManageInventory = row[vManageInventoryIdx]?.toLowerCase() === "true";
      const priceRaw = row[vPriceIdx] ? parseFloat(row[vPriceIdx].replace(/[^\d.]/g, "")) : 0;

      const vOptions: Record<string, string> = {};
      optionCols.forEach(col => {
        const name = row[col.nameIdx]?.trim();
        const value = row[col.valIdx]?.trim();
        if (name && value) {
          vOptions[name] = value;
        }
      });
      // Fallback option if none mapped
      if (Object.keys(vOptions).length === 0) {
        vOptions["Title"] = vTitle;
      }

      const variant: CsvVariant = {
        title: vTitle,
        sku: vSku,
        manage_inventory: vManageInventory,
        options: vOptions,
        prices: priceRaw > 0 ? [{ amount: priceRaw, currency_code: "inr" }] : []
      };

      const existingProd = csvProductsMap.get(handle);
      if (existingProd) {
        // Just add variant if SKU is unique and merge images/categories
        if (!existingProd.variants.some(v => v.sku.toLowerCase() === vSku.toLowerCase())) {
          existingProd.variants.push(variant);
        }
        category_ids.forEach(cid => {
          if (!existingProd.category_ids.includes(cid)) {
            existingProd.category_ids.push(cid);
          }
        });
        images.forEach(img => {
          if (!existingProd.images.some(i => i.url === img.url)) {
            existingProd.images.push(img);
          }
        });
      } else {
        csvProductsMap.set(handle, {
          id: idIdx !== -1 && row[idIdx]?.startsWith("prod_") ? row[idIdx] : undefined,
          handle,
          title,
          description: desc,
          status,
          thumbnail,
          images,
          category_ids,
          options: [], // Build later
          variants: [variant]
        });
      }
    }
  }

  // Build options for all CSV products based on variants options
  for (const prod of csvProductsMap.values()) {
    const optionsCollector = new Map<string, Set<string>>();
    for (const v of prod.variants) {
      for (const [optName, optVal] of Object.entries(v.options)) {
        if (!optionsCollector.has(optName)) {
          optionsCollector.set(optName, new Set());
        }
        optionsCollector.get(optName)!.add(optVal);
      }
    }
    prod.options = Array.from(optionsCollector.entries()).map(([title, values]) => ({
      title,
      values: Array.from(values)
    }));
  }
  logger.info(`Loaded ${csvProductsMap.size} unique products from CSV files.`);

  // 3. Load and parse data.ndjson Sanity backup file
  const ndjsonPath = path.resolve(process.cwd(), "data.ndjson");
  if (!fs.existsSync(ndjsonPath)) {
    throw new Error(`data.ndjson file not found at ${ndjsonPath}`);
  }
  const ndjsonContent = fs.readFileSync(ndjsonPath, "utf8");
  const lines = ndjsonContent.split(/\r?\n/).filter(line => line.trim() !== "");

  const finalProductsList: CsvProduct[] = [];

  for (const line of lines) {
    try {
      const doc = JSON.parse(line);
      if (doc._type !== "product") continue;

      const handle = doc.handle;
      if (!handle) continue;

      const title = doc.title;
      const description = blockContentToPlainText(doc.description || doc.richDescription || []);
      const thumbnail = doc.thumbnailR2?.url || doc.thumbnail?.url || "";
      const images = doc.galleryR2?.map((g: any) => ({ url: g.url })) || [];
      if (thumbnail && !images.some((i: any) => i.url === thumbnail)) {
        images.unshift({ url: thumbnail });
      }

      const medusaId = doc.medusaId || doc._id.replace("drafts.", "");
      const medusaType = doc.medusaType || null;

      // Extract specs for price, sku, and category mapping
      const specs = doc.additionalSpecs || [];
      const specMap = new Map<string, string>(specs.map((s: any) => [s.label?.toLowerCase() || "", s.value || ""]));
      
      const skuSpec = specMap.get("style number") || specMap.get("style no.") || specMap.get("style no") || "";
      const priceSpec = specMap.get("price") || specMap.get("mrp") || "";
      let price = 0;
      if (priceSpec) {
        price = parseFloat(priceSpec.replace(/[^\d.]/g, ""));
      }

      // Check if product exists in CSV
      const csvProd = csvProductsMap.get(handle);

      if (csvProd) {
        // Enriched with NDJSON details
        csvProd.id = medusaId.startsWith("prod_") ? medusaId : csvProd.id;
        csvProd.description = description || csvProd.description;
        csvProd.thumbnail = thumbnail || csvProd.thumbnail;
        if (images.length > 0) {
          images.forEach((img: any) => {
            if (!csvProd.images.some(i => i.url === img.url)) {
              csvProd.images.push(img);
            }
          });
        }
        csvProd.medusaType = medusaType;
        
        finalProductsList.push(csvProd);
        csvProductsMap.delete(handle); // Remove from map so we don't duplicate
      } else {
        // Product is not in CSV (e.g. Maison Enfants kids stools/furniture)
        // Resolve categories from specs
        const category_ids: string[] = [];
        const catSpec = specMap.get("category") || specMap.get("subcategory") || specMap.get("sub-category") || specMap.get("collection") || "";
        if (catSpec) {
          const mappedId = findCategoryId(catSpec);
          if (mappedId) category_ids.push(mappedId);
        }
        
        // Also check if any database category handle matches handle parts
        if (category_ids.length === 0) {
          for (const cat of categories) {
            if (handle.includes(cat.handle) || cat.handle.includes(handle)) {
              category_ids.push(cat.id);
              break;
            }
          }
        }
        // Final fallback: link to general 'furniture' or 'maison-enfants'
        if (category_ids.length === 0) {
          const fallbackId = categoryHandleMap.get("maison-enfants") || categoryHandleMap.get("kids") || categoryHandleMap.get("furniture");
          if (fallbackId) category_ids.push(fallbackId);
        }

        const colorSpec = specMap.get("color") || "";
        const optionName = colorSpec ? "Color" : "Title";
        const optionValue = colorSpec ? colorSpec : "Default";

        const variant: CsvVariant = {
          title: optionValue,
          sku: skuSpec || `SKU-${handle.toUpperCase()}`,
          manage_inventory: false,
          options: { [optionName]: optionValue },
          prices: price > 0 ? [{ amount: price, currency_code: "inr" }] : []
        };

        finalProductsList.push({
          id: medusaId.startsWith("prod_") ? medusaId : undefined,
          handle,
          title,
          description,
          status: ProductStatus.PUBLISHED,
          thumbnail,
          images,
          category_ids,
          options: [{ title: optionName, values: [optionValue] }],
          variants: [variant],
          medusaType
        });
      }
    } catch (err: any) {
      logger.error(`Error parsing NDJSON line: ${err.message}`);
    }
  }

  // Add remaining CSV products that weren't in NDJSON
  for (const csvProd of csvProductsMap.values()) {
    finalProductsList.push(csvProd);
  }

  // Deduplicate products in finalProductsList by ID and handle
  const uniqueProductsMap = new Map<string, CsvProduct>();
  for (const p of finalProductsList) {
    const key = p.id || p.handle;
    if (uniqueProductsMap.has(key)) {
      const existing = uniqueProductsMap.get(key)!;
      for (const v of p.variants) {
        if (!existing.variants.some(ev => ev.sku.toLowerCase() === v.sku.toLowerCase())) {
          existing.variants.push(v);
        }
      }
      continue;
    }
    uniqueProductsMap.set(key, p);
  }

  const finalProducts = Array.from(uniqueProductsMap.values());
  for (const p of finalProducts) {
    const uniqueVariantsMap = new Map<string, CsvVariant>();
    for (const v of p.variants) {
      uniqueVariantsMap.set(v.sku.toLowerCase(), v);
    }
    p.variants = Array.from(uniqueVariantsMap.values());
    
    // Rebuild options based on unique variants
    const optionsCollector = new Map<string, Set<string>>();
    for (const v of p.variants) {
      for (const [optName, optVal] of Object.entries(v.options)) {
        if (!optionsCollector.has(optName)) {
          optionsCollector.set(optName, new Set());
        }
        optionsCollector.get(optName)!.add(optVal);
      }
    }
    p.options = Array.from(optionsCollector.entries()).map(([title, values]) => ({
      title,
      values: Array.from(values)
    }));
  }

  logger.info(`Ready to restore ${finalProducts.length} unique products to Medusa.`);

  // 4. Load or create Collections & Product Types dynamically
  const productTypes = await productModuleService.listProductTypes({}, { select: ["id", "value"], take: 9999 });
  const productTypeMap = new Map<string, string>(productTypes.map(t => [t.value.toLowerCase(), t.id]));

  async function getOrCreateProductTypeId(value: string): Promise<string | null> {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (productTypeMap.has(normalized)) return productTypeMap.get(normalized)!;
    
    try {
      const [created] = await productModuleService.createProductTypes([{ value }]);
      productTypeMap.set(normalized, created.id);
      logger.info(`Created ProductType: ${value} with ID: ${created.id}`);
      return created.id;
    } catch (err: any) {
      logger.warn(`Could not create ProductType ${value}: ${err.message}`);
      return null;
    }
  }

  const collections = await productModuleService.listProductCollections({}, { select: ["id", "handle"], take: 9999 });
  const collectionMap = new Map<string, string>(collections.map(c => [c.handle.toLowerCase(), c.id]));

  async function getOrCreateCollectionId(title: string, handle: string): Promise<string | null> {
    if (!title || !handle) return null;
    const normalized = handle.trim().toLowerCase();
    if (collectionMap.has(normalized)) return collectionMap.get(normalized)!;
    
    try {
      const [created] = await productModuleService.createProductCollections([{ title, handle }]);
      collectionMap.set(normalized, created.id);
      logger.info(`Created Collection: ${title} with ID: ${created.id}`);
      return created.id;
    } catch (err: any) {
      logger.warn(`Could not create Collection ${title}: ${err.message}`);
      return null;
    }
  }

  // 5. Delete existing products to avoid duplicate keys during seed
  logger.info("Fetching existing products in database for clean overwrite...");
  const existingProducts = await productModuleService.listProducts({}, { select: ["id", "handle"], take: 9999 });
  const existingProdIdsToDelete: string[] = [];
  const existingHandleSet = new Set(existingProducts.map(p => p.handle.toLowerCase()));

  for (const p of finalProducts) {
    if (p.id) {
      existingProdIdsToDelete.push(p.id);
    }
  }
  // Also collect by handle match
  for (const ep of existingProducts) {
    if (finalProducts.some(p => p.handle.toLowerCase() === ep.handle.toLowerCase())) {
      if (!existingProdIdsToDelete.includes(ep.id)) {
        existingProdIdsToDelete.push(ep.id);
      }
    }
  }

  if (existingProdIdsToDelete.length > 0) {
    logger.info(`Deleting ${existingProdIdsToDelete.length} existing products to prevent duplicates...`);
    await productModuleService.deleteProducts(existingProdIdsToDelete);
    logger.info("Deleted existing duplicate products.");
  }

  // 6. Import products in batches using createProductsWorkflow
  const batchSize = 25;
  let successCount = 0;

  for (let i = 0; i < finalProducts.length; i += batchSize) {
    const batch = finalProducts.slice(i, i + batchSize);
    logger.info(`Restoring batch ${Math.floor(i / batchSize) + 1} (${batch.length} products)...`);
    
    const formattedProducts: any[] = [];
    for (const p of batch) {
      let typeId: string | null = null;
      if (p.medusaType) {
        typeId = await getOrCreateProductTypeId(p.medusaType);
      }

      const payload: any = {
        title: p.title,
        handle: p.handle,
        description: p.description,
        status: p.status,
        thumbnail: p.thumbnail || undefined,
        images: p.images.length > 0 ? p.images : undefined,
        category_ids: p.category_ids.length > 0 ? p.category_ids : undefined,
        options: p.options,
        variants: p.variants.map(v => ({
          title: v.title,
          sku: v.sku,
          options: v.options,
          manage_inventory: v.manage_inventory,
          prices: v.prices.length > 0 ? v.prices : undefined
        }))
      };

      if (p.id) {
        payload.id = p.id;
      }
      if (typeId) {
        payload.type_id = typeId;
      }

      formattedProducts.push(payload);
    }

    try {
      await createProductsWorkflow(container).run({
        input: {
          products: formattedProducts
        }
      });
      successCount += batch.length;
      logger.info(`Batch ${Math.floor(i / batchSize) + 1} restored successfully.`);
    } catch (err: any) {
      logger.error(`Failed to restore batch ${Math.floor(i / batchSize) + 1}: ${err.message}`);
      
      // If batch fails, try importing product-by-product to skip corrupted ones
      logger.info("Retrying batch product-by-product...");
      for (const fp of formattedProducts) {
        try {
          await createProductsWorkflow(container).run({
            input: {
              products: [fp]
            }
          });
          successCount++;
          logger.info(`Restored product successfully: ${fp.title} (${fp.handle})`);
        } catch (singleErr: any) {
          logger.error(`Failed to restore product ${fp.title} (${fp.handle}): ${singleErr.message}`);
        }
      }
    }
  }

  logger.info(`Medusa Products restoration complete! Successfully restored ${successCount} products.`);
}
