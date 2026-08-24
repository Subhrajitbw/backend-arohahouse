import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  try {
    // Fetch all categories with their basic product info
    const { data: categories } = await query.graph({
      entity: "product_category",
      fields: [
        "id",
        "name",
        "handle",
        "parent_category_id",
        "products.id",
      ],
    });

    if (!categories || !Array.isArray(categories)) {
      return res.json({ categories: [], count: 0 });
    }

    // Step 1: Map categories by ID for easy tree building
    const map = new Map();
    categories.forEach((cat) => {
      // Check if products exist and have at least one entry
      const hasProducts = Array.isArray(cat.products) && cat.products.length > 0;
      map.set(cat.id, {
        ...cat,
        children: [],
        hasDirectProducts: hasProducts,
      });
    });

    // Step 2: Build the tree and identify roots
    const roots: any[] = [];
    map.forEach((node) => {
      if (node.parent_category_id && map.has(node.parent_category_id)) {
        map.get(node.parent_category_id).children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Step 3: Recursive pruning logic (Keep if node has products OR active children)
    const pruneEmpty = (nodes: any[]) => {
      return nodes.filter((node) => {
        const activeChildren = pruneEmpty(node.children);
        node.children = activeChildren;
        // Business Rule: Category must have direct products OR active sub-categories
        return node.hasDirectProducts || activeChildren.length > 0;
      });
    };

    const activeTree = pruneEmpty(roots);

    // Step 4: Flatten the tree back to a list for frontend compatibility
    const flatActive: any[] = [];
    const flatten = (nodes: any[]) => {
      nodes.forEach((node) => {
        const { children, ...rest } = node;
        flatActive.push(rest);
        if (children && children.length > 0) {
          flatten(children);
        }
      });
    };
    flatten(activeTree);

    return res.json({ 
      categories: flatActive,
      count: flatActive.length 
    });
  } catch (error: any) {
    console.error("Failed to fetch sidebar categories:", error);
    return res.status(500).json({ 
      message: "Internal server error", 
      error: error.message 
    });
  }
}
