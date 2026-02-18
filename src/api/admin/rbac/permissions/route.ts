import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../modules/rbac"

const listSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(100),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { page, limit } = listSchema.parse(req.query)
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const [permissions, count] = await rbac.listAndCountPermissions(
    {},
    {
      skip: (page - 1) * limit,
      take: limit,
    }
  )

  res.status(200).json({
    permissions,
    count,
    page,
    limit,
    last_page: Math.ceil(count / limit),
  })
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  type: z.enum(["predefined", "custom"]).optional().default("custom"),
  matcherType: z.enum(["api"]).optional().default("api"),
  matcher: z.string().min(1),
  actionType: z.enum(["read", "write", "delete"]),
  category_id: z.string().optional().nullable(),
  key: z.string().optional().default(""),
  method: z.string().optional().default(""),
  path: z.string().optional().default(""),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validated = createSchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const permission = await rbac.createPermissions({
    ...validated,
  })

  res.status(201).json(permission)
}
