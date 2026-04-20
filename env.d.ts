declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
    DATABASE_URL: string;
    REDIS_URL?: string;
    ADMIN_CORS: string;
    AUTH_CORS: string;
    STORE_CORS: string;
    JWT_SECRET: string;
    COOKIE_SECRET: string;

    // Storage & R2
    FILE_BASE_URL: string;
    R2_PUBLIC_BASE_URL?: string;
    R2_RAW_PREFIX?: string;
    S3_ACCESS_KEY_ID: string;
    S3_SECRET_ACCESS_KEY: string;
    S3_REGION: string;
    S3_BUCKET: string;
    S3_ENDPOINT?: string;

    // Notifications & Resend
    RESEND_API_KEY: string;
    RESEND_FROM_EMAIL: string;

    // Sanity
    SANITY_API_TOKEN: string;
    SANITY_PROJECT_ID: string;
    SANITY_STUDIO_URL?: string;

    // URLs
    ADMIN_DASHBOARD_URL?: string;
    MEDUSA_ADMIN_URL?: string;
    MEDUSA_BACKEND_URL?: string;
    STOREFRONT_URL?: string;

    // Image Conversion & GitHub
    IMAGE_CONVERSION_TOKEN?: string;
    IMAGE_CONVERSION_RAW_PREFIX?: string;
    GITHUB_DISPATCH_TOKEN?: string;
    GITHUB_REPO?: string;
    GITHUB_API_URL?: string;
    GITHUB_DISPATCH_EVENT?: string;

    // Search & External
    MEILISEARCH_HOST?: string;
    MEILISEARCH_API_KEY?: string;
    MEILISEARCH_PRODUCT_INDEX_NAME?: string;
    ALGOLIA_API_KEY?: string;
    ALGOLIA_APP_ID?: string;
    ALGOLIA_PRODUCT_INDEX_NAME?: string;
    STRIPE_API_KEY?: string;

    // Social Auth
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_CALLBACK_URL?: string;

    FACEBOOK_CLIENT_ID?: string;
    FACEBOOK_CLIENT_SECRET?: string;
    FACEBOOK_CALLBACK_URL?: string;

    LINKEDIN_CLIENT_ID?: string;
    LINKEDIN_CLIENT_SECRET?: string;
    LINKEDIN_CALLBACK_URL?: string;

    REDDIT_CLIENT_ID?: string;
    REDDIT_CLIENT_SECRET?: string;
    REDDIT_CALLBACK_URL?: string;

    PINTEREST_CLIENT_ID?: string;
    PINTEREST_CLIENT_SECRET?: string;
    PINTEREST_CALLBACK_URL?: string;
    DISABLE_MEDUSA_ADMIN?: string
  }
}
