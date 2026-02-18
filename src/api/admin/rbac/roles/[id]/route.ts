import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../../modules/rbac"

const idSchema = z.object({
  id: z.string().min(1),
})

const querySchema = z.object({
  include_permissions: z.coerce.boolean().optional().default(true),
  include_users: z.coerce.boolean().optional().default(false),
  include_policies: z.coerce.boolean().optional().default(true),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = idSchema.parse(req.params)
  const { include_permissions, include_users, include_policies } = querySchema.parse(req.query)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const relations = [] as string[]
  if (include_permissions) {
    relations.push("role_permissions", "role_permissions.permission")
  }
  if (include_users) {
    relations.push("user_roles")
  }
  if (include_policies) {
    relations.push("policies", "policies.permission")
  }

  const role = await rbac.retrieveRole(id, {
    relations: relations.length ? relations : undefined,
  })

  res.status(200).json(role)
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  is_super: z.boolean().optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = idSchema.parse(req.params)
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validated = updateSchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const existing = await rbac.retrieveRole(id)

  if (existing.is_super) {
    res.status(400).json({ message: "Super roles cannot be updated." })
    return
  }

  const updated = await rbac.updateRoles({ id }, validated)
  res.status(200).json(updated)
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = idSchema.parse(req.params)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const existing = await rbac.retrieveRole(id)
  if (existing.is_super) {
    res.status(400).json({ message: "Super roles cannot be deleted." })
    return
  }

  await rbac.deleteRoles(id)
  res.status(200).json({ id, deleted: true })
}
