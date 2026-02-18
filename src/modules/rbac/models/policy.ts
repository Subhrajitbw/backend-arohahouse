import { model } from "@medusajs/framework/utils"
import { InferTypeOf } from "@medusajs/framework/types"
import Role from "./role"
import Permission from "./permission"

const Policy = model.define("rbac_policy", {
  id: model.id().primaryKey(),
  type: model.enum(["allow", "deny"]),
  role: model.belongsTo(() => Role, {
    mappedBy: "policies",
  }),
  permission: model.belongsTo(() => Permission, {
    mappedBy: "policies",
  }),
})

export type PolicyModelType = InferTypeOf<typeof Policy>

export default Policy
