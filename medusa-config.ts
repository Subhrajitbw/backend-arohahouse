import { loadEnv, defineConfig } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

// Decoupled Admin support: allow the standalone admin (7001) and backend (9000)
const adminCors =
  process.env.ADMIN_CORS || "http://localhost:7001,http://localhost:9000";
const authCors =
  process.env.AUTH_CORS || "http://localhost:5173,http://localhost:7001,http://localhost:9000";
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

  modules: [
    /**
     * FILE STORAGE (Core Module)
     */
    {
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
     * SEARCH MODULES (Conditional injection to prevent build crashes)
     */
    ...(process.env.MEILISEARCH_HOST
      ? [
          {
            resolve: "./src/modules/meilisearch", // Points to your custom meilisearch wrapper
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
     * AUTH MODULE
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
              callbackUrl: "http://localhost:5173/oauth/callback",
              scope: ["email", "profile", "openid"],
            },
          },
          // {
          //   resolve: "@medusajs/auth-facebook",
          //   id: "facebook",
          //   options: {
          //     clientId: process.env.FACEBOOK_CLIENT_ID,
          //     clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
          //     callbackUrl: `${process.env.MEDUSA_BACKEND_URL}/auth/customer/facebook/callback`,
          //   },
          // },
          // {
          //   resolve: "./src/modules/social-auth/linkedin-provider",
          //   id: "linkedin",
          //   options: {
          //     clientId: process.env.LINKEDIN_CLIENT_ID,
          //     clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
          //     callbackUrl: `${process.env.MEDUSA_BACKEND_URL}/auth/customer/linkedin/callback`,
          //   },
          // },
          // {
          //   resolve: "./src/modules/social-auth/reddit-provider",
          //   id: "reddit",
          //   options: {
          //     clientId: process.env.REDDIT_CLIENT_ID,
          //     clientSecret: process.env.REDDIT_CLIENT_SECRET,
          //     callbackUrl: `${process.env.MEDUSA_BACKEND_URL}/auth/customer/reddit/callback`,
          //   },
          // },
          // {
          //   resolve: "./src/modules/social-auth/pinterest-provider",
          //   id: "pinterest",
          //   options: {
          //     clientId: process.env.PINTEREST_CLIENT_ID,
          //     clientSecret: process.env.PINTEREST_CLIENT_SECRET,
          //     callbackUrl: `${process.env.MEDUSA_BACKEND_URL}/auth/customer/pinterest/callback`,
          //   },
          // },
        ],
      },
    },
  ],

  plugins: [
    { resolve: "@tsc_tech/medusa-plugin-product-seo", options: {} },
    { resolve: "@tsc_tech/medusa-plugin-product-variant-images", options: {} },
    { resolve: "@alphabite/medusa-collection-images", options: {} },
    { resolve: "@agilo/medusa-analytics-plugin", options: {} },
  ],

  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true", // Disabled on AWS, Enabled on Vercel/Local
    vite: (config: any) => {
      return {
        ...config,
        server: {
          ...(config.server || {}),
        },
        define: {
          ...(config.define || {}),
          __MAX_UPLOAD_FILE_SIZE__: JSON.stringify(15 * 1024 * 1024), // 15MB
        },
      }
    },
  },
});
