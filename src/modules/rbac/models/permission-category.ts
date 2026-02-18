import { model } from "@medusajs/framework/utils"
import { InferTypeOf } from "@medusajs/framework/types"
import Permission from "./permission"

const PermissionCategory = model.define("rbac_permission_category", {
  id: model.id().primaryKey(),
  name: model.text(),
  type: model.enum(["predefined", "custom"]),
  permissions: model.hasMany(() => Permission, {
    mappedBy: "category",
  }),
})

export type PermissionCategoryModelType = InferTypeOf<typeof PermissionCategory>

export default PermissionCategory
