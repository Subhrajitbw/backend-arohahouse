import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../../../modules/rbac"

const paramsSchema = z.object({
  user_id: z.string().min(1),
})

const modifySchema = z.object({
  role_ids: z.array(z.string().min(1)).optional(),
  role_names: z.array(z.string().min(1)).optional(),
})

const resolveRoleIds = async (
  rbac: RbacModuleService,
  roleIds: string[] | undefined,
  roleNames: string[] | undefined
): Promise<string[]> => {
  const ids = new Set(roleIds ?? [])

  if (roleNames?.length) {
    const roles = await rbac.listRoles({ name: roleNames })
    roles.forEach((role) => ids.add(role.id))
  }

  return Array.from(ids)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { user_id } = paramsSchema.parse(req.params)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const userRoles = await rbac.listUserRoles(
    { user_id },
    { relations: ["role"] }
  )

  res.status(200).json({
    user_id,
    roles: userRoles.map((userRole) => userRole.role).filter(Boolean),
    role_ids: userRoles.map((userRole) => userRole.role_id),
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { user_id } = paramsSchema.parse(req.params)
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const { role_ids, role_names } = modifySchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const resolvedRoleIds = await resolveRoleIds(rbac, role_ids, role_names)

  if (!resolvedRoleIds.length) {
    res.status(400).json({ message: "No roles provided." })
    return
  }

  const existing = await rbac.listUserRoles({ user_id })
  const existingIds = new Set(existing.map((item) => item.role_id))

  const toCreate = resolvedRoleIds
    .filter((roleId) => !existingIds.has(roleId))
    .map((roleId) => ({ user_id, role_id: roleId }))

  const created = toCreate.length
    ? await rbac.createUserRoles(toCreate)
    : []

  res.status(200).json({ user_id, created })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { user_id } = paramsSchema.parse(req.params)
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const { role_ids, role_names } = modifySchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const resolvedRoleIds = await resolveRoleIds(rbac, role_ids, role_names)

  if (!resolvedRoleIds.length) {
    res.status(400).json({ message: "No roles provided." })
    return
  }

  const existing = await rbac.listUserRoles({
    user_id,
    role_id: resolvedRoleIds,
  })

  const ids = existing.map((item) => item.id)
  if (ids.length) {
    await rbac.deleteUserRoles(ids)
  }

  res.status(200).json({ user_id, deleted: ids })
}
