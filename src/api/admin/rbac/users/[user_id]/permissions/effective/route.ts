import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../../../../modules/rbac"

const paramsSchema = z.object({
  user_id: z.string().min(1),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { user_id } = paramsSchema.parse(req.params)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const result = await rbac.getEffectivePermissions(user_id)
  res.status(200).json({ user_id, ...result })
}
