const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const filePath = path.join(__dirname, '../Chair.xlsx');
if (!fs.existsSync(filePath)) {
  console.error('Chair.xlsx not found');
  return;
}

try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`File: Chair.xlsx | Sheet: "${sheetName}"`);
  console.log(`Total rows read: ${data.length}`);

  let nonFreeCount = 0;
  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (row && row.length > 0) {
      const nonNulls = row.filter(cell => cell !== null && cell !== undefined && cell !== '');
      if (nonNulls.length > 0) {
        nonFreeCount++;
        if (nonFreeCount <= 15) {
          console.log(`Row ${r}:`, JSON.stringify(row.slice(0, 10)));
        }
      }
    }
  }
  console.log(`Total non-empty rows: ${nonFreeCount}`);

} catch (e) {
  console.error('Error reading Chair.xlsx:', e.message);
}
