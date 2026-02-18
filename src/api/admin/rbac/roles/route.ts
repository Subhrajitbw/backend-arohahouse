import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../modules/rbac"

const listSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
  include_permissions: z.coerce.boolean().optional().default(false),
  include_users: z.coerce.boolean().optional().default(false),
  include_policies: z.coerce.boolean().optional().default(false),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { page, limit, include_permissions, include_users, include_policies } =
    listSchema.parse(req.query)

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

  const [roles, count] = await rbac.listAndCountRoles(
    {},
    {
      skip: (page - 1) * limit,
      take: limit,
      relations: relations.length ? relations : undefined,
    }
  )

  res.status(200).json({
    roles,
    count,
    page,
    limit,
    last_page: Math.ceil(count / limit),
  })
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  is_super: z.boolean().optional().default(false),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validated = createSchema.parse(body)

  const role = await rbac.createRoles({
    ...validated,
  })

  res.status(201).json(role)
}
