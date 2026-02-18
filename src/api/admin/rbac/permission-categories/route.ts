import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../modules/rbac"

const listSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  include_permissions: z.coerce.boolean().optional().default(false),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { page, limit, include_permissions } = listSchema.parse(req.query)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const [categories, count] = await rbac.listAndCountPermissionCategories(
    {},
    {
      skip: (page - 1) * limit,
      take: limit,
      relations: include_permissions ? ["permissions"] : undefined,
    }
  )

  res.status(200).json({
    categories,
    count,
    page,
    limit,
    last_page: Math.ceil(count / limit),
  })
}

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["predefined", "custom"]).optional().default("custom"),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validated = createSchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const category = await rbac.createPermissionCategories(validated)

  res.status(201).json(category)
}
