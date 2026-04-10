import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  try {
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: [
        "id",
        "name",
        "handle",
        "parent_category_id",
        "products.id",
        "products.thumbnail",
        "products.title",
        "products.handle",
      ],
      filters: {
        parent_category_id: { $ne: null },
      },
    });

    const curated: any[] = [];
    const seenProductIds = new Set<string>();

    for (const cat of categories) {
      // REQUIREMENT 1: Category MUST possess at least 3 products natively to be displayed
      if (!cat.products || cat.products.length < 3) continue;

      const unseen: any[] = [];

      for (const p of cat.products) {
        if (!seenProductIds.has(p.id)) {
          unseen.push(p);
        }
      }

      // REQUIREMENT 2 & 3: Image and Featured must not repeat if possible.
      // If we have unseen products, we use the first one as the image.
      // If ALL products are already seen in other categories, we still don't drop the category!
      // We explicitly leave the image as null (which the frontend catches with a placeholder wrapper),
      // because seen product images MUST NOT be used as a category image.
      const imageProduct = unseen.length > 0 ? unseen[0] : null;

      // We mark the image product as seen so it doesn't get used elsewhere
      if (imageProduct) {
        seenProductIds.add(imageProduct.id);
      }

      // Featured products only pull from the REMAINING unseen products (excluding the image one) to definitively prevent repeats.
      // If there are no unseen products left, featuredProducts just remains empty rather than repeating old products.
      const featuredProducts = unseen.length > 1 ? unseen.slice(1, 4) : [];

      // Mark the featured products as seen globally
      featuredProducts.forEach((p) => seenProductIds.add(p.id));

      curated.push({
        id: cat.id,
        name: cat.name,
        handle: cat.handle,
        parent_category_id: cat.parent_category_id,
        image: imageProduct?.thumbnail || null,
        featuredProducts,
      });
    }

    return res.json({ curated_categories: curated });
  } catch (error: any) {
    console.error("Failed to curate categories:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
}
