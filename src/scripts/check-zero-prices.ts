import {
  ExecArgs,
  IProductModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export default async function checkZeroPrices({ container }: ExecArgs) {
  const logger = container.resolve("logger");
  const productModuleService: IProductModuleService = container.resolve(Modules.PRODUCT);

  logger.info("Querying products and variants with pricing from database...");
  
  // listProducts does not automatically return prices in v2 unless fetched via pricing / remoteQuery,
  // but we can query variants and their prices, or retrieve products with pricing.
  // In Medusa v2, we query via remoteQuery to get products, variants, and their prices.
  const remoteQuery = container.resolve("remoteQuery");
  
  const query = {
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "variants.id",
      "variants.title",
      "variants.sku",
      "variants.price_set.prices.amount",
      "variants.price_set.prices.currency_code"
    ]
  };

  const dbProducts = await remoteQuery(query);
  logger.info(`Loaded ${dbProducts.length} products via remoteQuery.`);

  let zeroPriceCount = 0;
  let missingPriceCount = 0;
  const zeroPriceProducts: any[] = [];
  const missingPriceProducts: any[] = [];

  for (const p of dbProducts) {
    let hasZeroPrice = false;
    let hasMissingPrice = false;
    const variantDetails: string[] = [];

    for (const v of p.variants || []) {
      const prices = v.price_set?.prices || [];
      if (prices.length === 0) {
        hasMissingPrice = true;
        variantDetails.push(`Variant "${v.title}" (${v.sku || "no sku"}): NO PRICES REGISTERED`);
      } else {
        const inrPrice = prices.find((pr: any) => pr.currency_code === "inr");
        if (!inrPrice) {
          hasMissingPrice = true;
          variantDetails.push(`Variant "${v.title}" (${v.sku || "no sku"}): No INR price (found: ${prices.map((pr: any) => pr.currency_code).join(", ")})`);
        } else if (inrPrice.amount === 0) {
          hasZeroPrice = true;
          variantDetails.push(`Variant "${v.title}" (${v.sku || "no sku"}): INR price is 0`);
        }
      }
    }

    if (hasZeroPrice) {
      zeroPriceCount++;
      zeroPriceProducts.push({
        id: p.id,
        title: p.title,
        handle: p.handle,
        details: variantDetails
      });
    }

    if (hasMissingPrice) {
      missingPriceCount++;
      missingPriceProducts.push({
        id: p.id,
        title: p.title,
        handle: p.handle,
        details: variantDetails
      });
    }
  }

  logger.info(`\n=== ZERO PRICE PRODUCTS COUNT: ${zeroPriceCount} ===`);
  for (const p of zeroPriceProducts) {
    logger.info(`Product: "${p.title}" (${p.handle})`);
    for (const d of p.details) {
      logger.info(`  - ${d}`);
    }
  }

  logger.info(`\n=== MISSING/NO INR PRICE PRODUCTS COUNT: ${missingPriceCount} ===`);
  for (const p of missingPriceProducts) {
    logger.info(`Product: "${p.title}" (${p.handle})`);
    for (const d of p.details) {
      logger.info(`  - ${d}`);
    }
  }
}
