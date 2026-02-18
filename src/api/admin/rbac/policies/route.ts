import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import RbacModuleService from "../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../modules/rbac"

const listSchema = z.object({
  page: z.coerce.number().min(1).optional().default(1),
  limit: z.coerce.number().min(1).max(200).optional().default(100),
  role_id: z.string().optional(),
  permission_id: z.string().optional(),
  type: z.enum(["allow", "deny"]).optional(),
  include_permission: z.coerce.boolean().optional().default(true),
  include_role: z.coerce.boolean().optional().default(false),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const {
    page,
    limit,
    role_id,
    permission_id,
    type,
    include_permission,
    include_role,
  } = listSchema.parse(req.query)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  const relations = [] as string[]
  if (include_permission) {
    relations.push("permission")
  }
  if (include_role) {
    relations.push("role")
  }

  const [policies, count] = await rbac.listAndCountPolicies(
    {
      ...(role_id ? { role_id } : {}),
      ...(permission_id ? { permission_id } : {}),
      ...(type ? { type } : {}),
    },
    {
      skip: (page - 1) * limit,
      take: limit,
      relations: relations.length ? relations : undefined,
    }
  )

  res.status(200).json({
    policies,
    count,
    page,
    limit,
    last_page: Math.ceil(count / limit),
  })
}

const createSchema = z.object({
  role_id: z.string().min(1),
  permission_id: z.string().min(1),
  type: z.enum(["allow", "deny"]),
})

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body
  const validated = createSchema.parse(body)

  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)
  const policy = await rbac.createPolicies(validated)

  res.status(201).json(policy)
}
