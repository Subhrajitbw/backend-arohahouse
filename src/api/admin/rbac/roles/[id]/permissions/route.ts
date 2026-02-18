import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../../../modules/rbac"

const paramsSchema = z.object({
  id: z.string().min(1),
})

const modifySchema = z.object({
  permission_ids: z.array(z.string().min(1)).optional(),
  permission_keys: z.array(z.string().min(1)).optional(),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = paramsSchema.parse(req.params)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const rolePermissions = await rbac.listRolePermissions(
    { role_id: id },
    { relations: ["permission"] }
  )

  const permissions = rolePermissions
    .map((rolePermission) => rolePermission.permission)
    .filter(Boolean)

  res.status(200).json({ role_id: id, permissions })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = paramsSchema.parse(req.params)
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const { permission_ids, permission_keys } = modifySchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const resolvedIds = new Set(permission_ids ?? [])
  if (permission_keys?.length) {
    const permissions = await rbac.listPermissions({ key: permission_keys })
    permissions.forEach((permission) => resolvedIds.add(permission.id))
  }

  if (!resolvedIds.size) {
    res.status(400).json({ message: "No permissions provided." })
    return
  }

  const existing = await rbac.listRolePermissions({ role_id: id })
  const existingIds = new Set(
    existing.map(
      (item) => (item as unknown as { permission_id?: string }).permission_id
    )
  )

  const toCreate = Array.from(resolvedIds)
    .filter((permissionId) => !existingIds.has(permissionId))
    .map((permissionId) => ({ role_id: id, permission_id: permissionId }))

  const created = toCreate.length
    ? await rbac.createRolePermissions(toCreate)
    : []

  res.status(200).json({ role_id: id, created })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = paramsSchema.parse(req.params)
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const { permission_ids, permission_keys } = modifySchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const resolvedIds = new Set(permission_ids ?? [])
  if (permission_keys?.length) {
    const permissions = await rbac.listPermissions({ key: permission_keys })
    permissions.forEach((permission) => resolvedIds.add(permission.id))
  }

  if (!resolvedIds.size) {
    res.status(400).json({ message: "No permissions provided." })
    return
  }

  const existing = await rbac.listRolePermissions({
    role_id: id,
    permission_id: Array.from(resolvedIds),
  })

  const ids = existing.map((item) => item.id)
  if (ids.length) {
    await rbac.deleteRolePermissions(ids)
  }

  res.status(200).json({ role_id: id, deleted: ids })
}
