import { model } from "@medusajs/framework/utils"
import { InferTypeOf } from "@medusajs/framework/types"
import RolePermission from "./role-permission"
import UserRole from "./user-role"
import Policy from "./policy"

const Role = model
  .define("rbac_role", {
    id: model.id().primaryKey(),
    name: model.text(),
    description: model.text().nullable(),
    is_super: model.boolean().default(false),
    role_permissions: model.hasMany(() => RolePermission, {
      mappedBy: "role",
    }),
    user_roles: model.hasMany(() => UserRole, {
      mappedBy: "role",
    }),
    policies: model.hasMany(() => Policy, {
      mappedBy: "role",
    }),
  })

export type RoleModelType = InferTypeOf<typeof Role>

export default Role
