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

  const category = await rbac.retrievePermissionCategory(id, {
    relations: ["permissions"],
  })

  res.status(200).json(category)
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["predefined", "custom"]).optional(),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = idSchema.parse(req.params)
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validated = updateSchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const updated = await rbac.updatePermissionCategories({ id }, validated)

  res.status(200).json(updated)
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = idSchema.parse(req.params)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  await rbac.deletePermissionCategories(id)
  res.status(200).json({ id, deleted: true })
}
