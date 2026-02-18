import {
  MedusaRequest,
  MedusaResponse,
  MedusaNextFunction,
  AuthenticatedMedusaRequest,
} from "@medusajs/framework"
import RbacModuleService, {
  PermissionRequirement,
} from "../../modules/rbac/service"
import { RBAC_MODULE } from "../../modules/rbac"

export const requirePermissions = (permissions: PermissionRequirement[]) => {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const authContext = (req as AuthenticatedMedusaRequest).auth_context
    if (!authContext?.actor_id || authContext.actor_type !== "user") {
      res.status(401).json({ message: "Unauthorized" })
      return
    }

    const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

    const isInitialized = await rbac.isInitialized()
    if (!isInitialized) {
      return next()
    }

    const allowed = await rbac.hasPermissions(authContext.actor_id, permissions)
    if (!allowed) {
      res.status(403).json({
        message: "Forbidden",
        required_permissions: permissions,
      })
      return
    }

    return next()
  }
}
