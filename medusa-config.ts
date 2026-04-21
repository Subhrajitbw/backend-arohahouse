import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

// -----------------------------
// CORS CONFIG (IMPORTANT)
// -----------------------------
const adminCors =
  process.env.ADMIN_CORS || "http://localhost:7001,http://localhost:9000"

const authCors =
  process.env.AUTH_CORS ||
  "http://localhost:5173,http://localhost:7001,http://localhost:9000"

const storeCors = process.env.STORE_CORS || "http://localhost:5173"

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL!,
    databaseDriverOptions: {
      connection: {
        // Essential: AWS RDS requires this object structure for SSL
        ssl: {
          rejectUnauthorized: false
        },
      },
      // Optimization: Prevents the "Pool is full" crash on t2.micro
      pool: {
        min: 0, // Set to 0 to allow the pool to clear connections when idle
        max: 5,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 60000,
      },
    },

    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

    // -----------------------------
    // HTTP CONFIG
    // -----------------------------
    http: {
      storeCors,
      adminCors,
      authCors,

      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },

    // -----------------------------
    // COOKIE CONFIG (CROSS DOMAIN)
    // -----------------------------
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
    },

    // -----------------------------
    // WORKER MODE (LOW RAM SAFE)
    // -----------------------------
    workerMode: "server", // IMPORTANT for t2.micro
  },

  // -----------------------------
  // MODULES
  // -----------------------------
  modules: [
    /**
     * FILE STORAGE (R2 via S3)
     */
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-s3",
            id: "s3",
            options: {
              file_url: process.env.FILE_BASE_URL, // CDN URL
              access_key_id: process.env.S3_ACCESS_KEY_ID,
              secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
              region: process.env.S3_REGION,
              bucket: process.env.S3_BUCKET,
              endpoint: process.env.S3_ENDPOINT, // R2 endpoint
            },
          },
        ],
      },
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
    { resolve: "./src/modules/product-media" },
    { resolve: "./src/modules/fashion" },

    {
      resolve: "./src/modules/sanity",
      options: {
        api_token: process.env.SANITY_API_TOKEN,
        project_id: process.env.SANITY_PROJECT_ID,
        api_version: "2023-01-01",
        dataset: "production",
        studio_url: process.env.SANITY_STUDIO_URL,
        type_map: {
          product: "product",
        },
      },
    },

    /**
     * SEARCH (OPTIONAL)
     */
    ...(process.env.MEILISEARCH_HOST
      ? [
          {
            resolve: "./src/modules/meilisearch",
            options: {
              host: process.env.MEILISEARCH_HOST,
              apiKey: process.env.MEILISEARCH_API_KEY,
              productIndexName:
                process.env.MEILISEARCH_PRODUCT_INDEX_NAME || "products",
            },
          },
        ]
      : []),

    /**
     * AUTH
     */
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "@medusajs/medusa/auth-google",
            id: "google",
            options: {
              clientId: process.env.GOOGLE_CLIENT_ID,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET,

              // ✅ IMPORTANT: FIX FOR VERCEL ADMIN
              callbackUrl:
                process.env.GOOGLE_CALLBACK_URL ||
                "https://admin.arohahouse.com/oauth/callback",

              scope: ["email", "profile", "openid"],
            },
          },
        ],
      },
    },
  ],

  // -----------------------------
  // PLUGINS
  // -----------------------------
  plugins: [
    { resolve: "@tsc_tech/medusa-plugin-product-seo", options: {} },
    { resolve: "@tsc_tech/medusa-plugin-product-variant-images", options: {} },
    { resolve: "@alphabite/medusa-collection-images", options: {} },
    { resolve: "@agilo/medusa-analytics-plugin", options: {} },
  ],

  // -----------------------------
  // ADMIN CONFIG (CRITICAL SECTION)
  // -----------------------------
  admin: {

    // ✅ REAL upload limit (backend enforced)
    maxUploadFileSize: 15 * 1024 * 1024,

    vite: (config: any) => {
      return {
        ...config,
        define: {
          ...(config.define || {}),

          // ✅ frontend limit (UX)
          __MAX_UPLOAD_FILE_SIZE__: JSON.stringify(15 * 1024 * 1024),
        },
      }
    },
  },
})