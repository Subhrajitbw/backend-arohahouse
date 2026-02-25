import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { 
  sanitySyncProductsWorkflow,
  sanitySyncCategoriesWorkflow,
  sanitySyncCollectionsWorkflow,
  sanitySyncTypesWorkflow
} from "../../../../workflows/sanity-sync"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const workflowEngine = req.scope.resolve(Modules.WORKFLOW_ENGINE)

  // List executions for all four workflows to show a complete history in the UI
  const [executions, count] = await workflowEngine.listAndCountWorkflowExecutions(
    {
      workflow_id: [
        "sanity-sync-products",
        "sanity-sync-categories",
        "sanity-sync-collections",
        "sanity-sync-types"
      ],
    },
    { 
      order: { created_at: "DESC" },
      take: 20 
    }
  )

  res.json({ workflow_executions: executions, count })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  // ✅ Create a shared config with the container cast to any to satisfy TS
  const runConfig = {
    container: req.scope as any,
  }

  // To sync everything safely, we run them in order.
  // Taxonomies first, so products can reference them immediately.
  
  await sanitySyncTypesWorkflow.run({
    ...runConfig,
    input: {} // Bulk sync logic in step handles empty input
  })
  
  await sanitySyncCollectionsWorkflow.run({
    ...runConfig,
    input: {}
  })
  
  await sanitySyncCategoriesWorkflow.run({
    ...runConfig,
    input: {}
  })
  
  // Finally, sync products
  const { transaction } = await sanitySyncProductsWorkflow.run({
    ...runConfig,
    input: {}, // Sync all products
  })

  res.json({ 
    transaction_id: transaction.transactionId,
    details: "Full sync initiated: Types, Collections, Categories, and Products."
  })
}