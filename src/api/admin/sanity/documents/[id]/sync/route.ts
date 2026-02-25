import {
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"

import {
  sanitySyncProductsWorkflow,
  sanitySyncCategoriesWorkflow,
  sanitySyncCollectionsWorkflow,
  sanitySyncTypesWorkflow,
} from "../../../../../../workflows/sanity-sync"

// =====================================================
// 🔹 Detect type automatically from Medusa ID
// =====================================================

const detectTypeFromId = (id: string): "product" | "category" | "collection" | "type" => {
  if (id.startsWith("pcat_")) return "category"
  if (id.startsWith("pcol_")) return "collection"
  if (id.startsWith("ptyp_")) return "type"

  // Default → product (prod_)
  return "product"
}

// =====================================================
// 🔹 Helper: Resolve Sanity document
// =====================================================

const getSanityDocument = async (
  container: any,
  id: string,
  type: string
) => {
  const sanityService = container.resolve("sanityService")

  console.log("Fetching Sanity document:", { id, type })

  switch (type) {
    case "category":
      return sanityService.getCategoryByMedusaId(id)

    case "collection":
      return sanityService.getCollectionByMedusaId(id)

    case "type":
      return sanityService.getTypeByMedusaId(id)

    default:
      return sanityService.getProductByMedusaId(id)
  }
}

// =====================================================
// ======================= GET ==========================
// =====================================================

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  // Auto-detect type from ID
  const type = detectTypeFromId(id)

  try {
    const sanity_document = await getSanityDocument(
      req.scope,
      id,
      type
    )

    console.log("Sanity GET result:", {
      id,
      type,
      found: !!sanity_document,
    })

    res.json({
      sanity_document: sanity_document || null,
      studio_url: sanity_document
        ? `${process.env.SANITY_STUDIO_URL}/desk/${sanity_document._id}`
        : null,
    })
  } catch (error) {
    console.error("Sanity GET error:", error)

    res.status(500).json({
      message: "Failed to fetch Sanity document",
      error: (error as Error).message,
    })
  }
}

// =====================================================
// ======================= POST =========================
// =====================================================

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params

  // Auto-detect type from ID
  const type = detectTypeFromId(id)

  const workflowConfig = {
    container: req.scope as any,
  }

  try {
    let result: any

    console.log("Triggering sync:", { id, type })

    switch (type) {
      case "category":
        result = await sanitySyncCategoriesWorkflow.run({
          ...workflowConfig,
          input: { category_ids: [id] },
        })
        break

      case "collection":
        result = await sanitySyncCollectionsWorkflow.run({
          ...workflowConfig,
          input: { collection_ids: [id] },
        })
        break

      case "type":
        result = await sanitySyncTypesWorkflow.run({
          ...workflowConfig,
          input: { type_ids: [id] },
        })
        break

      default:
        result = await sanitySyncProductsWorkflow.run({
          ...workflowConfig,
          input: { product_ids: [id] },
        })
    }

    res.json({
      transaction_id: result.transaction.transactionId,
    })
  } catch (error) {
    console.error("Sanity POST error:", error)

    res.status(500).json({
      message: "Failed to trigger Sanity sync",
      error: (error as Error).message,
    })
  }
}