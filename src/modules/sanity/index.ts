// src/modules/sanity/index.ts
import { Module } from "@medusajs/framework/utils";
import SanityModuleService from "./service";

export const SANITY_MODULE = "sanity"; // 👈 fix: should be "sanity" not "sanityModuleService"

export default Module(SANITY_MODULE, {
  service: SanityModuleService,
  // 👈 remove definition entirely, it's no longer a valid property
});
