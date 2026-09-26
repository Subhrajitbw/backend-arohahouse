import { Container, getContainer } from "@cloudflare/containers"

export interface Env {
  MEDUSA_CONTAINER: any
  // Required Application Secrets & Configs
  DATABASE_URL?: string
  DATABASE_SSL?: string
  JWT_SECRET?: string
  COOKIE_SECRET?: string
  COOKIE_SECURE?: string
  STORE_CORS?: string
  ADMIN_CORS?: string
  AUTH_CORS?: string
  MEDUSA_WORKER_MODE?: string

  // Storage / R2
  FILE_BASE_URL?: string
  R2_PUBLIC_BASE_URL?: string
  R2_RAW_PREFIX?: string
  S3_ACCESS_KEY_ID?: string
  S3_SECRET_ACCESS_KEY?: string
  S3_REGION?: string
  S3_BUCKET?: string
  S3_ENDPOINT?: string

  // Sanity
  SANITY_API_TOKEN?: string
  SANITY_PROJECT_ID?: string
  SANITY_DATASET?: string
  SANITY_STUDIO_URL?: string

  // Resend
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string

  // Search
  MEILISEARCH_HOST?: string
  MEILISEARCH_API_KEY?: string
  MEILISEARCH_PRODUCT_INDEX_NAME?: string
  ALGOLIA_API_KEY?: string
  ALGOLIA_APP_ID?: string
  ALGOLIA_PRODUCT_INDEX_NAME?: string

  // Redis
  REDIS_URL?: string

  // Image Conversion / GitHub
  GITHUB_DISPATCH_TOKEN?: string
  GITHUB_REPO?: string
  GITHUB_API_URL?: string
  GITHUB_DISPATCH_EVENT?: string
  IMAGE_CONVERSION_RAW_PREFIX?: string

  // Social Auth
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_CALLBACK_URL?: string

  [key: string]: unknown
}

export class MedusaContainer extends Container<Env> {
  defaultPort = 9000
  sleepAfter = "10m"

  constructor(ctx: any, env: Env) {
    super(ctx, env)

    const forwardedEnv: Record<string, string> = {
      NODE_ENV: "production",
      PORT: "9000",
      HOST: "0.0.0.0",
      MEDUSA_WORKER_MODE: (env.MEDUSA_WORKER_MODE as string) || "shared",
    }

    // Forward all string environment variables and secrets to the container runtime
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string" && key !== "MEDUSA_CONTAINER") {
        forwardedEnv[key] = value
      }
    }

    this.envVars = forwardedEnv
  }

  override onStart(): void {
    console.log("[Medusa Container] Instance started successfully.")
  }

  override onStop(params: { exitCode?: number; reason?: string }): void {
    console.log(
      `[Medusa Container] Instance stopped. Reason: ${params.reason || "unknown"}, Exit code: ${
        params.exitCode ?? "none"
      }`
    )
  }

  override onError(error: unknown): any {
    console.error("[Medusa Container] Container runtime error:", error)
    throw error
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = getContainer(env.MEDUSA_CONTAINER, "medusa")
    return await container.fetch(request)
  },
}
