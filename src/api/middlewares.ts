import { defineMiddlewares } from "@medusajs/framework/http"
import { authenticate, validateAndTransformBody } from "@medusajs/framework"

import { adminProductTypeRoutesMiddlewares } from "./store/custom/product-types/middlewares"

import {
  CreateCategoryImagesSchema,
} from "./admin/categories/[category_id]/images/route"

import {
  UpdateCategoryImagesSchema,
  DeleteCategoryImagesSchema,
} from "./admin/categories/[category_id]/images/batch/route"

import { ImageConversionCallbackSchema } from "./admin/image-conversions/callback/route"

export default defineMiddlewares({
  routes: [
    // -----------------------------
    // CUSTOM PRODUCT TYPE MIDDLEWARES
    // -----------------------------
    ...adminProductTypeRoutesMiddlewares,

    // -----------------------------
    // ⚠️ BODY LIMIT (ONLY FOR CUSTOM ROUTES)
    // DOES NOT OVERRIDE CORE ADMIN ROUTES
    // -----------------------------
    {
      matcher: "/custom/*",
      method: ["POST", "PUT"],
      bodyParser: {
        sizeLimit: "20mb",
      },
    },

    // -----------------------------
    // AUTHENTICATION
    // -----------------------------
    {
      matcher: "/store/custom/customer/*",
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },

    // -----------------------------
    // VALIDATION ROUTES
    // -----------------------------
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
  ],
})