import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
        databaseDriverOptions: {
         ssl: { rejectUnauthorized: false },
         connection: { ssl: { rejectUnauthorized: false } }
    },

    // Redis (set REDIS_URL in production; falls back to local)
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
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
    {
      resolve: "./src/modules/product-media",
    },
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

  ],
  admin: {
      vite: () => {
        return {
          server: {
            allowedHosts: [".arohahouse.com"],
          },
        }
      },
    },
})
