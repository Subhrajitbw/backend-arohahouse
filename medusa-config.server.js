"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@medusajs/framework/utils");
(0, utils_1.loadEnv)(process.env.NODE_ENV || 'development', process.cwd());
module.exports = (0, utils_1.defineConfig)({
    projectConfig: {
        databaseUrl: process.env.DATABASE_URL,
        redisUrl: process.env.REDIS_URL,
        http: {
            storeCors: process.env.STORE_CORS,
            adminCors: process.env.ADMIN_CORS,
            authCors: process.env.AUTH_CORS,
            jwtSecret: process.env.JWT_SECRET || "supersecret",
            cookieSecret: process.env.COOKIE_SECRET || "supersecret",
        }
    },
    modules: [
        //     {
        //   resolve: "@medusajs/medusa/file",
        //   options: {
        //     providers: [
        //       {
        //         resolve: "@medusajs/medusa/file-s3",
        //         id: "s3",
        //         options: {
        //           file_url: process.env.FILE_BASE_URL,
        //           access_key_id: process.env.S3_ACCESS_KEY_ID,
        //           secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
        //           region: process.env.S3_REGION,
        //           bucket: process.env.S3_BUCKET,
        //           endpoint: process.env.S3_ENDPOINT,
        //         },
        //       },
        //     ],
        //   },
        // },
        {
            resolve: "./src/modules/product-media",
        },
        {
            resolve: './src/modules/fashion',
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
        {
            resolve: "./src/modules/sanity",
            options: {
                api_token: process.env.SANITY_API_TOKEN,
                project_id: process.env.SANITY_PROJECT_ID,
                api_version: new Date().toISOString().split("T")[0],
                dataset: "production",
                studio_url: process.env.SANITY_STUDIO_URL ||
                    "http://localhost:3000/studio",
                type_map: {
                    product: "product",
                },
            },
        },
        {
            resolve: "./src/modules/algolia",
            options: {
                appId: process.env.ALGOLIA_APP_ID,
                apiKey: process.env.ALGOLIA_API_KEY,
                productIndexName: process.env.ALGOLIA_PRODUCT_INDEX_NAME,
            },
        },
        {
            resolve: "./src/modules/meilisearch",
            options: {
                host: process.env.MEILISEARCH_HOST,
                apiKey: process.env.MEILISEARCH_API_KEY,
                productIndexName: process.env.MEILISEARCH_PRODUCT_INDEX_NAME,
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
            resolve: '@agilo/medusa-analytics-plugin',
            options: {},
        },
    ],
    admin: {
        vite: () => {
            return {
                server: {
                    allowedHosts: [".arohahouse.com"],
                },
            };
        },
    },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkdXNhLWNvbmZpZy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL21lZHVzYS1jb25maWcuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxxREFBaUU7QUFFakUsSUFBQSxlQUFPLEVBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLElBQUksYUFBYSxFQUFFLE9BQU8sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFBO0FBRTdELE1BQU0sQ0FBQyxPQUFPLEdBQUcsSUFBQSxvQkFBWSxFQUFDO0lBQzVCLGFBQWEsRUFBRTtRQUNiLFdBQVcsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFlBQVk7UUFDckMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUztRQUMvQixJQUFJLEVBQUU7WUFDSixTQUFTLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVO1lBQ2pDLFNBQVMsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVU7WUFDakMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsU0FBUztZQUMvQixTQUFTLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLElBQUksYUFBYTtZQUNsRCxZQUFZLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLElBQUksYUFBYTtTQUN6RDtLQUNGO0lBQ0QsT0FBTyxFQUFFO1FBQ1AsUUFBUTtRQUNSLHNDQUFzQztRQUN0QyxlQUFlO1FBQ2YsbUJBQW1CO1FBQ25CLFVBQVU7UUFDViwrQ0FBK0M7UUFDL0Msb0JBQW9CO1FBQ3BCLHFCQUFxQjtRQUNyQixpREFBaUQ7UUFDakQseURBQXlEO1FBQ3pELGlFQUFpRTtRQUNqRSwyQ0FBMkM7UUFDM0MsMkNBQTJDO1FBQzNDLCtDQUErQztRQUMvQyxhQUFhO1FBQ2IsV0FBVztRQUNYLFNBQVM7UUFDVCxPQUFPO1FBQ1AsS0FBSztRQUNMO1lBQ0UsT0FBTyxFQUFFLDZCQUE2QjtTQUN2QztRQUNEO1lBQ0UsT0FBTyxFQUFFLHVCQUF1QjtTQUNqQztRQUNEO1lBQ0UsT0FBTyxFQUFFLCtCQUErQjtZQUN4QyxPQUFPLEVBQUU7Z0JBQ1AsU0FBUyxFQUFFO29CQUNUO3dCQUNFLE9BQU8sRUFBRSxzQkFBc0I7d0JBQy9CLEVBQUUsRUFBRSxRQUFRO3dCQUNaLE9BQU8sRUFBRTs0QkFDUCxRQUFRLEVBQUUsQ0FBQyxPQUFPLENBQUM7NEJBQ25CLE9BQU8sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWM7NEJBQ25DLElBQUksRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQjt5QkFDcEM7cUJBQ0Y7aUJBQ0Y7YUFDRjtTQUNGO1FBQ0Q7WUFDRSxPQUFPLEVBQUUsc0JBQXNCO1lBQy9CLE9BQU8sRUFBRTtnQkFDUCxTQUFTLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0I7Z0JBQ3ZDLFVBQVUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQjtnQkFDekMsV0FBVyxFQUFFLElBQUksSUFBSSxFQUFFLENBQUMsV0FBVyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDbkQsT0FBTyxFQUFFLFlBQVk7Z0JBQ3JCLFVBQVUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGlCQUFpQjtvQkFDdkMsOEJBQThCO2dCQUNoQyxRQUFRLEVBQUU7b0JBQ1IsT0FBTyxFQUFFLFNBQVM7aUJBQ25CO2FBQ0Y7U0FDRjtRQUNEO1lBQ0UsT0FBTyxFQUFFLHVCQUF1QjtZQUNoQyxPQUFPLEVBQUU7Z0JBQ1AsS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsY0FBYztnQkFDakMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsZUFBZTtnQkFDbkMsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQkFBMEI7YUFDekQ7U0FDRjtRQUNEO1lBQ0UsT0FBTyxFQUFFLDJCQUEyQjtZQUNwQyxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCO2dCQUNsQyxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7Z0JBQ3ZDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsOEJBQThCO2FBQzdEO1NBQ0Y7S0FFRjtJQUNELE9BQU8sRUFBRTtRQUNQO1lBQ0UsT0FBTyxFQUFFLHFDQUFxQztZQUM5QyxPQUFPLEVBQUUsRUFBRTtTQUNaO1FBQ0Q7WUFDRSxPQUFPLEVBQUUsZ0RBQWdEO1lBQ3pELE9BQU8sRUFBRSxFQUFFO1NBQ1o7UUFDRDtZQUNFLE9BQU8sRUFBRSxxQ0FBcUM7WUFDOUMsT0FBTyxFQUFFLEVBQUU7U0FDWjtRQUNEO1lBQ0UsT0FBTyxFQUFFLGdDQUFnQztZQUN6QyxPQUFPLEVBQUUsRUFBRTtTQUNaO0tBQ0Y7SUFDRCxLQUFLLEVBQUU7UUFDSCxJQUFJLEVBQUUsR0FBRyxFQUFFO1lBQ1QsT0FBTztnQkFDTCxNQUFNLEVBQUU7b0JBQ04sWUFBWSxFQUFFLENBQUMsaUJBQWlCLENBQUM7aUJBQ2xDO2FBQ0YsQ0FBQTtRQUNILENBQUM7S0FDRjtDQUNKLENBQUMsQ0FBQSJ9