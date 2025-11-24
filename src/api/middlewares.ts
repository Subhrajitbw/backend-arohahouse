import { defineMiddlewares } from "@medusajs/medusa";
import { adminProductTypeRoutesMiddlewares } from "./store/custom/product-types/middlewares";
import { authenticate, validateAndTransformBody } from "@medusajs/framework";

import { CreateCategoryImagesSchema } from "./admin/categories/[category_id]/images/route";
import { UpdateCategoryImagesSchema, DeleteCategoryImagesSchema } from "./admin/categories/[category_id]/images/batch/route";

export default defineMiddlewares([
  ...adminProductTypeRoutesMiddlewares,

  {
    method: "ALL",
    matcher: "/store/custom/customer/*",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },

  {
    matcher: "/admin/categories/:category_id/images",
    method: ["POST"],
    middlewares: [validateAndTransformBody(CreateCategoryImagesSchema)],
  },

  {
    matcher: "/admin/categories/:category_id/images/batch",
    method: ["POST"],
    middlewares: [validateAndTransformBody(UpdateCategoryImagesSchema)],
  },

  {
    matcher: "/admin/categories/:category_id/images/batch",
    method: ["DELETE"],
    middlewares: [validateAndTransformBody(DeleteCategoryImagesSchema)],
  },
]);
