import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

/**
 * LOCAL DEV SAFE DEFAULTS
 * Do NOT rely on dynamic localhost detection.
 * Be explicit to avoid session + CORS failures.
 */

const adminCors =
  process.env.ADMIN_CORS ||
  "http://localhost:9000,http://127.0.0.1:9000"

const authCors =
  process.env.AUTH_CORS ||
  "http://localhost:9000,http://127.0.0.1:9000"

const storeCors =
  process.env.STORE_CORS ||
  "http://localhost:5173,http://127.0.0.1:5173"

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL!,
    databaseDriverOptions: {
      ssl: { rejectUnauthorized: false },
      connection: { ssl: { rejectUnauthorized: false } },
    },
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },

  modules: [
    /**
     * FILE STORAGE (R2 / S3)
     */
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.FILE_BASE_URL!,
              access_key_id: process.env.S3_ACCESS_KEY_ID!,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY!,
              region: process.env.S3_REGION!,
              bucket: process.env.S3_BUCKET!,
              endpoint: process.env.S3_ENDPOINT,
              prefix:
                process.env.IMAGE_CONVERSION_RAW_PREFIX ??
                process.env.R2_RAW_PREFIX ??
                "",
            },
          },
        ],
      },
    },

    /**
     * CUSTOM MODULES
     */
    {
      resolve: "./src/modules/product-media",
    },
    {
      resolve: "./src/modules/fashion",
    },
    {
      resolve: "./src/modules/rbac",
    },

    /**
     * NOTIFICATIONS
     */
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/resend",
            id: "resend",
            options: {
              channels: ["email"],
              api_key: process.env.RESEND_API_KEY!,
              from: process.env.RESEND_FROM_EMAIL!,
            },
          },
        ],
      },
    },

    /**
     * SANITY SYNC MODULE
     */
    {
      resolve: "./src/modules/sanity",
      options: {
        api_token: process.env.SANITY_API_TOKEN,
        project_id: process.env.SANITY_PROJECT_ID,
        // Use a fixed version string
        api_version: "2023-01-01",
        dataset: "production",
        studio_url: process.env.SANITY_STUDIO_URL || "http://localhost:3000/studio",
        type_map: {
          product: "product",
        },
      },
    },

    /**
     * SEARCH MODULES
     */
    {
      resolve: "./src/modules/algolia",
      options: {
        appId: process.env.ALGOLIA_APP_ID!,
        apiKey: process.env.ALGOLIA_API_KEY!,
        productIndexName: process.env.ALGOLIA_PRODUCT_INDEX_NAME!,
      },
    },
    {
      resolve: "./src/modules/meilisearch",
      options: {
        host: process.env.MEILISEARCH_HOST!,
        apiKey: process.env.MEILISEARCH_API_KEY!,
        productIndexName: process.env.MEILISEARCH_PRODUCT_INDEX_NAME!,
      },
    },
  ],

  plugins: [
    {
      resolve: "@tsc_tech/medusa-plugin-product-seo",
      options: {},
    },
    {
      resolve: "@tsc_tech/medusa-plugin-product-variant-images",
      options: {},
    },
    {
      resolve: "@alphabite/medusa-collection-images",
      options: {},
    },
    {
      resolve: "@agilo/medusa-analytics-plugin",
      options: {},
    },
  ],

  /**
   * ADMIN CONFIG
   */
  admin: {
    vite: (config) => {
      return {
        ...config,
        server: {
          ...(config.server || {}),
        },
      }
    },
  },
})
