import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

// Decoupled Admin support: allow the standalone admin (7001) and backend (9000)
const adminCors =
  process.env.ADMIN_CORS || "http://localhost:7001,http://localhost:9000";
const authCors =
  process.env.AUTH_CORS || "http://localhost:7001,http://localhost:9000";
const storeCors = process.env.STORE_CORS || "http://localhost:5173";

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL!,
    databaseDriverOptions: {
      connection: {
        ssl: { rejectUnauthorized: false },
      },
    },
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    http: {
      storeCors,
      adminCors,
      authCors,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
    },
  },

  modules: {
    /**
     * FILE STORAGE (Core Module)
     */
    file: {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.FILE_BASE_URL,
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION,
              bucket: process.env.S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT,
            },
          },
        ],
      },
    },

    /**
     * NOTIFICATIONS (Core Module)
     */
    notification: {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "./src/modules/resend",
            id: "resend",
            options: {
              channels: ["email"],
              api_key: process.env.RESEND_API_KEY,
              from: process.env.RESEND_FROM_EMAIL,
            },
          },
        ],
      },
    },

    /**
     * CUSTOM MODULES
     */
    productMedia: { resolve: "./src/modules/product-media" },
    fashion: { resolve: "./src/modules/fashion" },
    sanity: {
      resolve: "./src/modules/sanity",
      options: {
        api_token: process.env.SANITY_API_TOKEN,
        project_id: process.env.SANITY_PROJECT_ID,
        api_version: "2023-01-01",
        dataset: "production",
      },
    },

    /**
     * SEARCH MODULES (Conditional injection to prevent build crashes)
     */
    ...(process.env.MEILISEARCH_HOST
      ? {
          meilisearch: {
            resolve: "./src/modules/meilisearch", // Points to your custom meilisearch wrapper
            options: {
              host: process.env.MEILISEARCH_HOST,
              apiKey: process.env.MEILISEARCH_API_KEY,
              productIndexName:
                process.env.MEILISEARCH_PRODUCT_INDEX_NAME || "products",
            },
          },
        }
      : {}),
  },

  plugins: [
    { resolve: "@tsc_tech/medusa-plugin-product-seo", options: {} },
    { resolve: "@tsc_tech/medusa-plugin-product-variant-images", options: {} },
    { resolve: "@alphabite/medusa-collection-images", options: {} },
    { resolve: "@agilo/medusa-analytics-plugin", options: {} },
  ],

  admin: {
    disable: true, // Admin is hosted separately
  },
});
