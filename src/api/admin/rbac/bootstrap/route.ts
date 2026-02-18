import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../modules/rbac"

const RBAC_PERMISSIONS = [
  {
    key: "rbac.roles.read",
    name: "Read roles",
    matcher: "/admin/rbac/roles",
    actionType: "read",
  },
  {
    key: "rbac.roles.write",
    name: "Write roles",
    matcher: "/admin/rbac/roles",
    actionType: "write",
  },
  {
    key: "rbac.roles.delete",
    name: "Delete roles",
    matcher: "/admin/rbac/roles",
    actionType: "delete",
  },
  {
    key: "rbac.permissions.read",
    name: "Read permissions",
    matcher: "/admin/rbac/permissions",
    actionType: "read",
  },
  {
    key: "rbac.permissions.write",
    name: "Write permissions",
    matcher: "/admin/rbac/permissions",
    actionType: "write",
  },
  {
    key: "rbac.permissions.delete",
    name: "Delete permissions",
    matcher: "/admin/rbac/permissions",
    actionType: "delete",
  },
  {
    key: "rbac.users.read",
    name: "Read user roles",
    matcher: "/admin/rbac/users",
    actionType: "read",
  },
  {
    key: "rbac.users.write",
    name: "Write user roles",
    matcher: "/admin/rbac/users",
    actionType: "write",
  },
  {
    key: "rbac.users.delete",
    name: "Delete user roles",
    matcher: "/admin/rbac/users",
    actionType: "delete",
  },
  {
    key: "rbac.permission-categories.read",
    name: "Read permission categories",
    matcher: "/admin/rbac/permission-categories",
    actionType: "read",
  },
  {
    key: "rbac.permission-categories.write",
    name: "Write permission categories",
    matcher: "/admin/rbac/permission-categories",
    actionType: "write",
  },
  {
    key: "rbac.permission-categories.delete",
    name: "Delete permission categories",
    matcher: "/admin/rbac/permission-categories",
    actionType: "delete",
  },
  {
    key: "rbac.policies.read",
    name: "Read policies",
    matcher: "/admin/rbac/policies",
    actionType: "read",
  },
  {
    key: "rbac.policies.write",
    name: "Write policies",
    matcher: "/admin/rbac/policies",
    actionType: "write",
  },
  {
    key: "rbac.policies.delete",
    name: "Delete policies",
    matcher: "/admin/rbac/policies",
    actionType: "delete",
  },
]

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  if (!req.auth_context?.actor_id) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const initialized = await rbac.isInitialized()
  const isSuperAdmin = await rbac.isSuperAdmin(req.auth_context.actor_id)

  if (initialized && !isSuperAdmin) {
    res.status(403).json({ message: "Forbidden" })
    return
  }

  const categories = await rbac.listPermissionCategories({ name: "RBAC" })
  const category =
    categories[0] ??
    (await rbac.createPermissionCategories({
      name: "RBAC",
      type: "custom",
    }))

  const existingPermissions = await rbac.listPermissions({
    key: RBAC_PERMISSIONS.map((permission) => permission.key),
  })
  const existingKeys = new Set(existingPermissions.map((p) => p.key))

  const permissionsToCreate = RBAC_PERMISSIONS.filter(
    (permission) => !existingKeys.has(permission.key)
  ).map((permission) => ({
    ...permission,
    type: "custom" as const,
    matcherType: "api" as const,
    category_id: category.id,
    description: permission.name,
    method: "",
    path: permission.matcher,
    actionType: permission.actionType as "read" | "write" | "delete",
  }))

  const createdPermissions = permissionsToCreate.length
    ? await rbac.createPermissions(permissionsToCreate)
    : []

  res.status(200).json({
    initialized: true,
    permission_count: existingPermissions.length + createdPermissions.length,
  })
}
