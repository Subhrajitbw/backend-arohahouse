import {
  IProductModuleService,
  ExecArgs
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import * as fs from "fs";
import * as path from "path";

// Define CSV parsing functions
function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const rows: string[][] = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    const row: string[] = [];
    let insideQuote = false;
    let currentField = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (insideQuote && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (char === ',' && !insideQuote) {
        row.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField);
    rows.push(row);
  }
  return rows;
}

interface CSVCategory {
  id: string;
  name: string;
  handle: string;
  description: string;
  parent_id: string;
  rank: number;
  is_active: boolean;
  is_internal: boolean;
  full_path: string;
  external_id: string;
  metadata: Record<string, any>;
}

function parseCSVContent(csvText: string): CSVCategory[] {
  const parsedRows = parseCSV(csvText);
  if (parsedRows.length === 0) return [];
  
  const headers = parsedRows[0].map(h => h.trim().toLowerCase());
  const idIndex = headers.indexOf('id');
  const nameIndex = headers.indexOf('name');
  const handleIndex = headers.indexOf('handle');
  const descIndex = headers.indexOf('description');
  const parentIdIndex = headers.indexOf('parent category id');
  const rankIndex = headers.indexOf('rank');
  const isActiveIndex = headers.indexOf('is active');
  const isInternalIndex = headers.indexOf('is internal');
  const pathIndex = headers.indexOf('full category path');
  const extIdIndex = headers.indexOf('external id');
  const metaIndex = headers.indexOf('metadata');

  const categories: CSVCategory[] = [];
  
  for (let i = 1; i < parsedRows.length; i++) {
    const row = parsedRows[i];
    if (row.length < headers.length) continue;
    
    const id = row[idIndex]?.trim();
    if (!id) continue;
    
    const name = row[nameIndex]?.trim() || '';
    const handle = row[handleIndex]?.trim() || '';
    const description = row[descIndex]?.trim() || '';
    const parent_id = row[parentIdIndex]?.trim() || '';
    const rankStr = row[rankIndex]?.trim();
    const rank = rankStr ? parseInt(rankStr, 10) : 0;
    const is_active = (row[isActiveIndex]?.trim() || '').toLowerCase() === 'true';
    const is_internal = (row[isInternalIndex]?.trim() || '').toLowerCase() === 'true';
    const full_path = row[pathIndex]?.trim() || '';
    const external_id = row[extIdIndex]?.trim() || '';
    
    let metadata: Record<string, any> = {};
    const metaStr = row[metaIndex]?.trim();
    if (metaStr) {
      try {
        metadata = JSON.parse(metaStr);
      } catch (e) {
        // Ignored
      }
    }

    categories.push({
      id,
      name,
      handle,
      description,
      parent_id,
      rank: isNaN(rank) ? 0 : rank,
      is_active,
      is_internal,
      full_path,
      external_id,
      metadata
    });
  }
  
  return categories;
}

function escapeCSVField(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = str.replace(/"/g, '""');
    return `"${str}"`;
  }
  return str;
}

export default async function generateCategoryMap({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Starting category mapping script (READ-ONLY)...");

  // Read CSV
  const csvPath = path.resolve(process.cwd(), "medusa_categories_recovery.csv");
  if (!fs.existsSync(csvPath)) {
    logger.error(`CSV file not found at ${csvPath}`);
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf8");
  const parsedCategories = parseCSVContent(csvContent);

  // 1. SOURCE VALIDATION
  const errors: string[] = [];

  // Check source category count (including duplicates as raw rows, but validate unique data)
  logger.info(`Parsed ${parsedCategories.length} category records from CSV.`);
  if (parsedCategories.length !== 178) {
    errors.push(`Validation Error: Source category count is ${parsedCategories.length}, expected 178.`);
  }

  // Check duplicate source IDs and handles (ignoring completely identical duplicate rows)
  const idToRowMap = new Map<string, string>();
  const handleToRowMap = new Map<string, string>();
  
  for (const cat of parsedCategories) {
    const rowStr = JSON.stringify(cat);
    
    if (idToRowMap.has(cat.id)) {
      if (idToRowMap.get(cat.id) !== rowStr) {
        errors.push(`Validation Error: Conflict - duplicate source ID ${cat.id} has different contents.`);
      }
    } else {
      idToRowMap.set(cat.id, rowStr);
    }

    if (handleToRowMap.has(cat.handle)) {
      if (handleToRowMap.get(cat.handle) !== rowStr) {
        errors.push(`Validation Error: Conflict - duplicate source handle "${cat.handle}" has different contents.`);
      }
    } else {
      handleToRowMap.set(cat.handle, rowStr);
    }
  }

  // Check source parent IDs exist in the CSV IDs
  const allCSVIds = new Set(parsedCategories.map(c => c.id));
  for (const cat of parsedCategories) {
    if (cat.parent_id && !allCSVIds.has(cat.parent_id)) {
      errors.push(`Validation Error: Category "${cat.handle}" has parent ID "${cat.parent_id}" which is missing from the CSV.`);
    }
  }

  // Check for circular parent-child relationships in CSV
  const catMap = new Map<string, CSVCategory>();
  for (const cat of parsedCategories) {
    catMap.set(cat.id, cat);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();

  function hasCycle(catId: string): boolean {
    if (stack.has(catId)) return true;
    if (visited.has(catId)) return false;

    visited.add(catId);
    stack.add(catId);

    const cat = catMap.get(catId);
    if (cat && cat.parent_id) {
      if (hasCycle(cat.parent_id)) {
        return true;
      }
    }

    stack.delete(catId);
    return false;
  }

  for (const cat of parsedCategories) {
    if (hasCycle(cat.id)) {
      errors.push(`Validation Error: Circular relationship detected starting from category ID "${cat.id}".`);
      break;
    }
  }

  if (errors.length > 0) {
    logger.error("Source CSV validation failed with the following errors:");
    for (const err of errors) {
      logger.error(`  - ${err}`);
    }
  } else {
    logger.info("Source CSV validation successful (no conflicts, valid parent references, no cycles).");
  }

  // 2. RETRIEVE CURRENT DATABASE CATEGORIES
  logger.info("Querying the current Medusa database for categories...");
  const dbCategories = await productModuleService.listProductCategories(
    {},
    { select: ["id", "name", "handle", "parent_category_id", "metadata"], take: 9999 }
  );

  logger.info(`Retrieved ${dbCategories.length} product categories from the database.`);

  const dbCategoriesMap = new Map<string, any>();
  for (const dbCat of dbCategories) {
    dbCategoriesMap.set(dbCat.id, dbCat);
  }

  // Helper to reconstruct full category path of a database category
  function getDbCategoryFullPath(cat: any): string {
    const parts: string[] = [cat.name];
    let current = cat;
    while (current.parent_category_id) {
      const parent = dbCategoriesMap.get(current.parent_category_id);
      if (!parent) break;
      parts.unshift(parent.name);
      current = parent;
    }
    return parts.join(" > ");
  }

  // 3. MATCHING LOGIC
  const oldToNewIdMap: Record<string, string> = {};
  const reportRows: any[] = [];
  let matchedCount = 0;
  let unmatchedCount = 0;
  let ambiguousCount = 0;

  // First sort by depth so that parent relationships are resolved when matching children
  const depthMap = new Map<string, number>();
  function getDepth(cat: CSVCategory): number {
    if (depthMap.has(cat.id)) return depthMap.get(cat.id)!;
    if (!cat.parent_id) {
      depthMap.set(cat.id, 0);
      return 0;
    }
    const parent = catMap.get(cat.parent_id);
    if (!parent) {
      depthMap.set(cat.id, 0);
      return 0;
    }
    const depth = 1 + getDepth(parent);
    depthMap.set(cat.id, depth);
    return depth;
  }

  for (const cat of parsedCategories) {
    getDepth(cat);
  }

  const sortedCategories = [...parsedCategories].sort((a, b) => {
    return (depthMap.get(a.id) || 0) - (depthMap.get(b.id) || 0);
  });

  for (const cat of sortedCategories) {
    let matchedDbCat: any = null;
    let matchMethod: "EXTERNAL_ID" | "HANDLE" | "NAME_AND_PARENT" | "FULL_PATH" | null = null;
    let confidence: "EXACT" | "LOW" = "EXACT";
    let status: "MATCHED" | "UNMATCHED" | "AMBIGUOUS" = "UNMATCHED";
    let matchError = "";

    // Step 1: Match by external_id (stored in metadata.external_id)
    if (cat.external_id) {
      const matches = dbCategories.filter(
        dbCat => dbCat.metadata && dbCat.metadata.external_id === cat.external_id
      );
      if (matches.length === 1) {
        matchedDbCat = matches[0];
        matchMethod = "EXTERNAL_ID";
        status = "MATCHED";
      } else if (matches.length > 1) {
        status = "AMBIGUOUS";
        confidence = "LOW";
        matchError = `Multiple database categories match external_id "${cat.external_id}"`;
      }
    }

    // Step 2: Match by handle
    if (!matchedDbCat && status !== "AMBIGUOUS") {
      const matches = dbCategories.filter(dbCat => dbCat.handle === cat.handle);
      if (matches.length === 1) {
        matchedDbCat = matches[0];
        matchMethod = "HANDLE";
        status = "MATCHED";
      } else if (matches.length > 1) {
        status = "AMBIGUOUS";
        confidence = "LOW";
        matchError = `Multiple database categories match handle "${cat.handle}"`;
      }
    }

    // Step 3: Match by name + parent relationship
    if (!matchedDbCat && status !== "AMBIGUOUS") {
      const newParentId = cat.parent_id ? oldToNewIdMap[cat.parent_id] : null;
      const matches = dbCategories.filter(
        dbCat => dbCat.name === cat.name && (dbCat.parent_category_id || null) === newParentId
      );
      if (matches.length === 1) {
        matchedDbCat = matches[0];
        matchMethod = "NAME_AND_PARENT";
        status = "MATCHED";
      } else if (matches.length > 1) {
        status = "AMBIGUOUS";
        confidence = "LOW";
        matchError = `Multiple database categories match name "${cat.name}" and parent ID "${newParentId}"`;
      }
    }

    // Step 4: Match by full path
    if (!matchedDbCat && status !== "AMBIGUOUS") {
      const matches = dbCategories.filter(dbCat => {
        const dbPath = getDbCategoryFullPath(dbCat);
        return dbPath.toLowerCase() === cat.full_path.toLowerCase();
      });
      if (matches.length === 1) {
        matchedDbCat = matches[0];
        matchMethod = "FULL_PATH";
        status = "MATCHED";
      } else if (matches.length > 1) {
        status = "AMBIGUOUS";
        confidence = "LOW";
        matchError = `Multiple database categories match full path "${cat.full_path}"`;
      }
    }

    // Update counts and mapping
    if (status === "MATCHED" && matchedDbCat) {
      oldToNewIdMap[cat.id] = matchedDbCat.id;
      matchedCount++;
    } else if (status === "AMBIGUOUS") {
      ambiguousCount++;
    } else {
      unmatchedCount++;
      matchError = "No matching category found in the current Medusa database.";
    }

    reportRows.push({
      old_id: cat.id,
      new_id: matchedDbCat ? matchedDbCat.id : "",
      name: cat.name,
      handle: cat.handle,
      old_parent_id: cat.parent_id,
      new_parent_id: matchedDbCat ? (matchedDbCat.parent_category_id || "") : "",
      full_category_path: cat.full_path,
      match_method: matchMethod || "",
      confidence: matchedDbCat ? confidence : "",
      status,
      error: matchError
    });
  }

  // 4. WRITE OUTPUTS
  const recoveryDir = path.resolve(process.cwd(), "recovery");
  if (!fs.existsSync(recoveryDir)) {
    fs.mkdirSync(recoveryDir, { recursive: true });
  }

  // category-id-map.json (ONLY include confirmed MATCHED mappings)
  const mapJsonPath = path.join(recoveryDir, "category-id-map.json");
  fs.writeFileSync(mapJsonPath, JSON.stringify(oldToNewIdMap, null, 2), "utf8");
  logger.info(`Generated JSON mapping at ${mapJsonPath}`);

  // category-id-map-report.json
  const isComplete = (parsedCategories.length === 178 && matchedCount === 178 && unmatchedCount === 0 && ambiguousCount === 0);
  const reportJsonPath = path.join(recoveryDir, "category-id-map-report.json");
  const reportJson = {
    source_categories: parsedCategories.length,
    matched: matchedCount,
    unmatched: unmatchedCount,
    ambiguous: ambiguousCount,
    mapping_complete: isComplete,
    errors
  };
  fs.writeFileSync(reportJsonPath, JSON.stringify(reportJson, null, 2), "utf8");
  logger.info(`Generated report JSON at ${reportJsonPath}`);

  // category-id-map.csv
  const csvReportPath = path.join(recoveryDir, "category-id-map.csv");
  const csvHeaders = ['old_id', 'new_id', 'name', 'handle', 'old_parent_id', 'new_parent_id', 'full_category_path', 'match_method', 'confidence', 'status'];
  const csvContentRows = [csvHeaders.join(',')];
  for (const r of reportRows) {
    csvContentRows.push([
      escapeCSVField(r.old_id),
      escapeCSVField(r.new_id),
      escapeCSVField(r.name),
      escapeCSVField(r.handle),
      escapeCSVField(r.old_parent_id),
      escapeCSVField(r.new_parent_id),
      escapeCSVField(r.full_category_path),
      escapeCSVField(r.match_method),
      escapeCSVField(r.confidence),
      escapeCSVField(r.status)
    ].join(','));
  }
  fs.writeFileSync(csvReportPath, csvContentRows.join('\n'), "utf8");
  logger.info(`Generated CSV mapping report at ${csvReportPath}`);

  // 5. FINAL VERIFICATION & PRINT
  console.log("\n----------------- VERIFICATION -----------------");
  console.log(`source = ${parsedCategories.length}`);
  console.log(`matched = ${matchedCount}`);
  console.log(`unmatched = ${unmatchedCount}`);
  console.log(`ambiguous = ${ambiguousCount}`);
  console.log("------------------------------------------------");

  if (isComplete) {
    console.log("\nCATEGORY ID MAPPING COMPLETE");
    console.log("178 / 178 categories mapped.\n");
  } else {
    console.log("\nCATEGORY ID MAPPING INCOMPLETE OR FAILED");
    console.log(`${matchedCount} / 178 categories mapped.\n`);
  }
}
