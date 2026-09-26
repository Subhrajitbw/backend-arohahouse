#!/usr/bin/env node

/**
 * Sync secrets and environment variables from .env.server directly to Cloudflare
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const envPath = path.resolve(process.cwd(), ".env.server")

if (!fs.existsSync(envPath)) {
  console.error("❌ .env.server file not found at:", envPath)
  process.exit(1)
}

const rawContent = fs.readFileSync(envPath, "utf8")
const lines = rawContent.split("\n")

const secrets = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "RESEND_API_KEY",
  "SANITY_API_TOKEN",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_DISPATCH_TOKEN",
  "MEILISEARCH_API_KEY",
  "ALGOLIA_API_KEY",
]

const envMap = {}

for (const line of lines) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const eqIdx = trimmed.indexOf("=")
  if (eqIdx === -1) continue

  const key = trimmed.slice(0, eqIdx).trim()
  const val = trimmed.slice(eqIdx + 1).trim()
  envMap[key] = val
}

console.log("🔐 Starting Cloudflare Secrets sync from .env.server...\n")

let syncedCount = 0
let failedCount = 0

for (const secretKey of secrets) {
  const secretVal = envMap[secretKey]
  if (secretVal && secretVal !== "") {
    process.stdout.write(`⏳ Setting secret [${secretKey}]... `)
    try {
      execSync(`npx wrangler secret put ${secretKey}`, {
        input: secretVal,
        stdio: ["pipe", "pipe", "pipe"],
      })
      console.log("✅ Synced")
      syncedCount++
    } catch (err) {
      console.log(`❌ Failed: ${err.message}`)
      failedCount++
    }
  }
}

console.log(`\n🎉 Completed! Synced: ${syncedCount} secrets, Failed: ${failedCount}.`)
