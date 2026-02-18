import { Module } from "@medusajs/framework/utils"
import RbacModuleService from "./service"

export const RBAC_MODULE = "rbacModuleService"

export default Module(RBAC_MODULE, {
  service: RbacModuleService,
})
