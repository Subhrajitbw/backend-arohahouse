import * as XLSX from "xlsx";
import * as path from "path";
import { ExecArgs } from "@medusajs/framework/types";

export default async function listSheet({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const filePath = path.resolve(process.cwd(), "Chair.xlsx");
  
  logger.info(`Reading Chair.xlsx...`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  
  logger.info(`Total rows: ${data.length}`);
  
  // Find header
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(data.length, 3); r++) {
    if (data[r] && data[r].includes("Title")) {
      headerRowIndex = r;
      break;
    }
  }

  const header = data[headerRowIndex].map(h => String(h || "").trim());
  const titleIdx = header.indexOf("Title");
  const handleIdx = header.indexOf("Handle");
  const skuIdx = header.findIndex(h => h.toUpperCase() === "STYLE NO");
  const mrpIdx = header.indexOf("MRP");

  logger.info(`Header row index: ${headerRowIndex}`);
  logger.info(`Column indexes - Title: ${titleIdx}, Handle: ${handleIdx}, SKU: ${skuIdx}, MRP: ${mrpIdx}`);

  for (let r = headerRowIndex + 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;
    logger.info(`Row ${r}: Title="${row[titleIdx]}", Handle="${row[handleIdx]}", SKU="${row[skuIdx]}", MRP="${row[mrpIdx]}"`);
  }
}
