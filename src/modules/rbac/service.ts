import { MedusaService } from "@medusajs/framework/utils"
import Role from "./models/role"
import Permission from "./models/permission"
import RolePermission from "./models/role-permission"
import UserRole from "./models/user-role"
import Policy from "./models/policy"
import PermissionCategory from "./models/permission-category"

export type PermissionRequirement = {
  matcher: string
  action: "read" | "write" | "delete"
}

const normalizeMatcher = (matcher: string) => matcher.trim().toLowerCase()

const matchesPermission = (
  allowed: Array<{ matcher: string; actionType: string }>,
  required: PermissionRequirement
) => {
  const requiredMatcher = normalizeMatcher(required.matcher)
  return allowed.some((permission) => {
    const permissionMatcher = normalizeMatcher(permission.matcher)
    if (permission.actionType !== required.action) {
      return false
    }
    if (permissionMatcher === "*") {
      return true
    }
    if (requiredMatcher === permissionMatcher) {
      return true
    }
    return requiredMatcher.startsWith(permissionMatcher)
  })
}

export default class RbacModuleService extends MedusaService({
  Role,
  Permission,
  RolePermission,
  UserRole,
  Policy,
  PermissionCategory,
}) {
  async isInitialized(): Promise<boolean> {
    const [, userRoleCount] = await this.listAndCountUserRoles({}, { take: 1 })
    return userRoleCount > 0
  }

  async getUserRoles(userId: string) {
    return this.listUserRoles(
      { user_id: userId },
      { relations: ["role"] }
    )
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId)
    return userRoles.some((userRole) => Boolean(userRole.role?.is_super))
  }

  async getEffectivePermissions(userId: string): Promise<{
    is_super_admin: boolean
    role_ids: string[]
    permissions: Array<{
      id: string
      name: string
      key: string
      matcher: string
      actionType: string
    }>
  }> {
    const userRoles = await this.getUserRoles(userId)
    const roleIds = userRoles
      .map((userRole) => userRole.role_id)
      .filter(Boolean)

    const isSuperAdmin = userRoles.some((userRole) =>
      Boolean(userRole.role?.is_super)
    )

    if (isSuperAdmin) {
      return {
        is_super_admin: true,
        role_ids: roleIds,
        permissions: [
          {
            id: "*",
            name: "*",
            key: "*",
            matcher: "*",
            actionType: "read",
          },
          {
            id: "*",
            name: "*",
            key: "*",
            matcher: "*",
            actionType: "write",
          },
          {
            id: "*",
            name: "*",
            key: "*",
            matcher: "*",
            actionType: "delete",
          },
        ],
      }
    }

    const rolePermissions = roleIds.length
      ? await this.listRolePermissions(
          { role_id: roleIds },
          { relations: ["permission"] }
        )
      : []

    const rolePermissionIds = new Set(
      rolePermissions
        .map((rolePermission) => rolePermission.permission?.id)
        .filter((id): id is string => Boolean(id))
    )

    const policies = roleIds.length
      ? await this.listPolicies(
          { role_id: roleIds },
          { relations: ["permission"] }
        )
      : []

    const allowPolicyIds = new Set<string>()
    const denyPolicyIds = new Set<string>()

    for (const policy of policies) {
      const permissionId =
        policy.permission?.id ?? (policy as unknown as { permission_id?: string }).permission_id
      if (!permissionId) {
        continue
      }
      if (policy.type === "deny") {
        denyPolicyIds.add(permissionId)
      } else {
        allowPolicyIds.add(permissionId)
      }
    }

    const allowedPermissionIds = new Set<string>([
      ...rolePermissionIds,
      ...allowPolicyIds,
    ])

    for (const deniedId of denyPolicyIds) {
      allowedPermissionIds.delete(deniedId)
    }

    const permissionIds = Array.from(allowedPermissionIds)
    const permissions = permissionIds.length
      ? await this.listPermissions({ id: permissionIds })
      : []

    return {
      is_super_admin: false,
      role_ids: roleIds,
      permissions: permissions.map((permission) => ({
        id: permission.id,
        name: permission.name,
        key: permission.key,
        matcher: permission.matcher,
        actionType: permission.actionType,
      })),
    }
  }

  async hasPermissions(
    userId: string,
    required: PermissionRequirement[]
  ): Promise<boolean> {
    if (!required.length) {
      return true
    }

    const effective = await this.getEffectivePermissions(userId)
    if (effective.is_super_admin) {
      return true
    }

    return required.every((permission) =>
      matchesPermission(effective.permissions, permission)
    )
  }
}
