import { defineMiddlewares } from "@medusajs/medusa";
import { adminProductTypeRoutesMiddlewares } from "./store/custom/product-types/middlewares";
import { authenticate, validateAndTransformBody } from "@medusajs/framework";
import bodyParser from "body-parser";
import { CreateCategoryImagesSchema } from "./admin/categories/[category_id]/images/route";
import { UpdateCategoryImagesSchema, DeleteCategoryImagesSchema } from "./admin/categories/[category_id]/images/batch/route";
import { ImageConversionCallbackSchema } from "./admin/image-conversions/callback/route";

export default defineMiddlewares([
  ...adminProductTypeRoutesMiddlewares,

  // Allow larger image payloads (e.g. 15mb limit)
  {
    matcher: "/admin/(.*)", // Increase limits across all admin routes where large data might be sent
    method: "ALL", 
    middlewares: [
      bodyParser.json({ limit: "15mb" }),
      bodyParser.urlencoded({ limit: "15mb", extended: true })
    ]
  },
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
  {
    matcher: "/admin/image-conversions/callback",
    method: ["POST"],
    middlewares: [validateAndTransformBody(ImageConversionCallbackSchema)],
  },
]);