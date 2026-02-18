import { model } from "@medusajs/framework/utils"
import { InferTypeOf } from "@medusajs/framework/types"
import Role from "./role"

const UserRole = model
  .define("rbac_user_role", {
    id: model.id().primaryKey(),
    user_id: model.text(),
    role: model.belongsTo(() => Role, {
      mappedBy: "user_roles",
    }),
  })

export type UserRoleModelType = InferTypeOf<typeof UserRole>

export default UserRole
