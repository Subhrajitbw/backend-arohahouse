import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { ExecArgs } from "@medusajs/framework/types";

export default async function searchExcel({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  
  const files = [
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
    "Side Table.xlsx",
    "converted_data.xlsx"
  ];

  const searchTerms = ["serein", "elowen", "nimba", "obsidian", "ecru", "dune", "ivory", "price", "mrp"];

  for (const fileName of files) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) continue;

    try {
      const workbook = XLSX.readFile(filePath);
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        
        let foundCount = 0;
        for (let r = 0; r < data.length; r++) {
          const row = data[r];
          if (!row || row.length === 0) continue;
          
          const rowString = JSON.stringify(row).toLowerCase();
          for (const term of searchTerms) {
            if (rowString.includes(term)) {
              foundCount++;
              if (foundCount <= 3) {
                logger.info(`FOUND "${term}" in ${fileName} -> Sheet "${sheetName}" -> Row ${r}:`);
                logger.info(JSON.stringify(row).substring(0, 300) + "...");
              }
            }
          }
        }
        if (foundCount > 3) {
          logger.info(`... and ${foundCount - 3} more matches in ${fileName} -> Sheet "${sheetName}"`);
        }
      }
    } catch (err: any) {
      logger.error(`Error reading ${fileName}: ${err.message}`);
    }
  }
}
