import { model } from "@medusajs/framework/utils"
import { InferTypeOf } from "@medusajs/framework/types"
import RolePermission from "./role-permission"
import PermissionCategory from "./permission-category"
import Policy from "./policy"

const Permission = model
  .define("rbac_permission", {
    id: model.id().primaryKey(),
    name: model.text(),
    type: model.enum(["predefined", "custom"]),
    matcherType: model.enum(["api"]),
    matcher: model.text(),
    actionType: model.enum(["read", "write", "delete"]),
    description: model.text().nullable(),
    key: model.text(),
    method: model.text(),
    path: model.text(),
    role_permissions: model.hasMany(() => RolePermission, {
      mappedBy: "permission",
    }),
    category: model.belongsTo(() => PermissionCategory, {
      mappedBy: "permissions",
    }),
    policies: model.hasMany(() => Policy, {
      mappedBy: "permission",
    }),
  })

export type PermissionModelType = InferTypeOf<typeof Permission>

export default Permission
