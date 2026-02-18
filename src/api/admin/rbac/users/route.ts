import { z } from "zod"
import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import RbacModuleService from "../../../../modules/rbac/service"
import { RBAC_MODULE } from "../../../../modules/rbac"

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { limit, offset } = querySchema.parse(req.query)

  const userModule = req.scope.resolve(Modules.USER) as any
  const rbac: RbacModuleService = req.scope.resolve(RBAC_MODULE)

  let users: any[] = []
  let count = 0

  if (typeof userModule.listAndCountUsers === "function") {
    const result = await userModule.listAndCountUsers({}, { take: limit, skip: offset })
    users = result[0]
    count = result[1]
  } else {
    users = await userModule.listUsers({}, { take: limit, skip: offset })
    count = users.length
  }

  const userIds = users.map((user) => user.id).filter(Boolean)
  const userRoles = userIds.length
    ? await rbac.listUserRoles(
        { user_id: userIds },
        { relations: ["role"] }
      )
    : []

  const rolesByUser = new Map<string, any[]>()
  for (const userRole of userRoles) {
    const userId =
      (userRole as unknown as { user_id?: string }).user_id ?? userRole.user_id
    if (!userId) {
      continue
    }
    const existing = rolesByUser.get(userId) ?? []
    if (userRole.role) {
      existing.push(userRole.role)
    }
    rolesByUser.set(userId, existing)
  }

  const enriched = users.map((user) => ({
    ...user,
    roles: rolesByUser.get(user.id) ?? [],
  }))

  res.status(200).json({
    users: enriched,
    count,
    limit,
    offset,
  })
}
