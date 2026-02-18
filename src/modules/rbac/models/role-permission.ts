import { model } from "@medusajs/framework/utils"
import { InferTypeOf } from "@medusajs/framework/types"
import Role from "./role"
import Permission from "./permission"

const RolePermission = model
  .define("rbac_role_permission", {
    id: model.id().primaryKey(),
    role: model.belongsTo(() => Role, {
      mappedBy: "role_permissions",
    }),
    permission: model.belongsTo(() => Permission, {
      mappedBy: "role_permissions",
    }),
  })

export type RolePermissionModelType = InferTypeOf<typeof RolePermission>

export default RolePermission
