import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../modules/rbac"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const result = await rbac.getEffectivePermissions(req.auth_context.actor_id)
  const roles = await rbac.getUserRoles(req.auth_context.actor_id)

  res.status(200).json({
    user_id: req.auth_context.actor_id,
    ...result,
    roles: roles.map((userRole) => userRole.role).filter(Boolean),
  })
}
