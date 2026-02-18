import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../../modules/rbac"

const idSchema = z.object({
  id: z.string().min(1),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = idSchema.parse(req.params)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const permission = await rbac.retrievePermission(id)
  res.status(200).json(permission)
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(["predefined", "custom"]).optional(),
  matcherType: z.enum(["api"]).optional(),
  matcher: z.string().min(1).optional(),
  actionType: z.enum(["read", "write", "delete"]).optional(),
  category_id: z.string().optional().nullable(),
  key: z.string().optional(),
  method: z.string().optional(),
  path: z.string().optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = idSchema.parse(req.params)
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validated = updateSchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const updated = await rbac.updatePermissions({ id }, validated)
  res.status(200).json(updated)
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = idSchema.parse(req.params)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  await rbac.deletePermissions(id)
  res.status(200).json({ id, deleted: true })
}
