const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function main() {
  const filePath = path.join(__dirname, '../data.ndjson');
  if (!fs.existsSync(filePath)) {
    console.error('data.ndjson not found');
    return;
  }

  const targetId = 'prod_01KJ8P0NGE42MP7T9KZ3YVA4T7';
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const doc = JSON.parse(line);
      if (doc.medusaId === targetId || doc._id === targetId || doc._id === `drafts.${targetId}`) {
        console.log(JSON.stringify(doc, null, 2));
        break;
      }
    } catch (e) {}
  }
}

main();
