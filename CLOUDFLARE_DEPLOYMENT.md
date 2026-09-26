# Aroha House — Cloudflare Containers Deployment Guide

This document outlines the architecture, prerequisites, configuration, deployment, and operational procedures for running the **Aroha House Medusa v2 Backend** on **Cloudflare Containers**.

---

## 1. Architecture Overview

```
                          Incoming Request
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   Cloudflare Worker   │
                     │  (Durable Object DO)  │
                     └───────────┬───────────┘
                                 │ Proxies request to Container:9000
                                 ▼
                 ┌───────────────────────────────┐
                 │ Cloudflare Container (Node 20)│
                 │    Medusa v2 Core Backend     │
                 │   - HTTP Server & Admin (/app)│
                 │   - Subscribers & Workflows   │
                 │   (MEDUSA_WORKER_MODE=shared) │
                 └───────┬───────────────┬───────┘
                         │               │
      Direct PostgreSQL  │               │ S3 API
             (SSL)       ▼               ▼
                 ┌───────────────┐ ┌───────────────┐
                 │ Neon Database │ │ Cloudflare R2 │
                 │ (PostgreSQL)  │ │ (Raw & CDN)   │
                 └───────────────┘ └───────────────┘
                         │
                         ├─► Sanity CMS (Sync Subscribers)
                         ├─► Resend (Transactional Emails)
                         ├─► GitHub Actions (Image Processing Dispatch)
                         ├─► Meilisearch / Algolia (Search Indexing)
                         └─► Redis (Optional / External if configured)
```

---

## 2. Prerequisites & Pricing

> [!IMPORTANT]
> **Cloudflare Containers requires a Workers Paid plan.**
> Cloudflare Containers are not supported on the Workers Free plan.
> The container instance type is configured to `standard-1` (single instance, `max_instances: 1`) to optimize cost for low-traffic scenarios.

* **Cloudflare Account**: Workers Paid plan active.
* **Wrangler CLI**: Installed locally as a project devDependency (`yarn wrangler`).
* **Docker**: Installed on the local development machine (for testing container builds locally).
* **Node.js**: `v20.x` or higher with Corepack/Yarn `4.7.0`.
* **External Services**:
  * Neon PostgreSQL database (connection string with `sslmode=require`).
  * Cloudflare R2 bucket (`aroha`) and API tokens.
  * Sanity CMS project ID and API token.
  * Resend API key and sender email.

---

## 3. Container Lifecycle & Sleep Behavior

* **Idle Sleep**: The container is configured with `sleepAfter = "10m"`.
* **Lifecycle**:
  1. An incoming request hits the Cloudflare Worker.
  2. If the container is sleeping, the Durable Object supervisor boots the container automatically.
  3. Medusa starts and processes the request on port `9000`.
  4. The container stays active while receiving requests.
  5. After 10 minutes of inactivity, the supervisor stops the container to minimize resource usage and billing.
* **Cold Starts**: The initial request after sleep may take a few seconds while Node boots and connects to Neon. Subsequent requests are handled with near-zero latency.

---

## 4. Required Secrets & Environment Variables

Environment variables and secrets configured in Cloudflare are dynamically forwarded into the Container runtime via `src/cloudflare-worker.ts`.

### Setting Secrets in Cloudflare

Set sensitive secrets using `yarn wrangler secret put <KEY>`:

```bash
# Database
yarn wrangler secret put DATABASE_URL

# Medusa Security
yarn wrangler secret put JWT_SECRET
yarn wrangler secret put COOKIE_SECRET

# Cloudflare R2 Storage (S3 credentials)
yarn wrangler secret put S3_ACCESS_KEY_ID
yarn wrangler secret put S3_SECRET_ACCESS_KEY

# Sanity CMS
yarn wrangler secret put SANITY_API_TOKEN

# Resend Email
yarn wrangler secret put RESEND_API_KEY

# GitHub Dispatch for Image Processing
yarn wrangler secret put GITHUB_DISPATCH_TOKEN

# Optional Search & Social Auth
yarn wrangler secret put MEILISEARCH_API_KEY
yarn wrangler secret put ALGOLIA_API_KEY
yarn wrangler secret put GOOGLE_CLIENT_SECRET
yarn wrangler secret put REDIS_URL
```

### Environment Variables in `wrangler.jsonc` or Cloudflare Dashboard

Non-sensitive configuration variables:

| Variable | Recommended Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Node environment |
| `DATABASE_SSL` | `true` | Enforces SSL connection to Neon |
| `MEDUSA_WORKER_MODE` | `shared` | Runs both API and background workers |
| `STORE_CORS` | `https://your-storefront.com` | Storefront CORS origins |
| `ADMIN_CORS` | `https://your-backend.com,http://localhost:7001` | Admin CORS origins |
| `AUTH_CORS` | `https://your-storefront.com,https://your-backend.com` | Auth CORS origins |
| `FILE_BASE_URL` | `https://media.arohahouse.com/aroha` | R2 Public CDN URL |
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com/aroha` | Cloudflare R2 S3 Endpoint |
| `S3_BUCKET` | `aroha` | S3 / R2 Bucket name |
| `S3_REGION` | `auto` | R2 Region |
| `SANITY_PROJECT_ID` | `plyu49lt` | Sanity Project ID |
| `SANITY_DATASET` | `production` | Sanity Dataset |
| `RESEND_FROM_EMAIL` | `info@arohahouse.com` | Verified sender email |
| `GITHUB_REPO` | `Subhrajitbw/backend-arohahouse` | Repo for image conversion dispatch |

---

## 5. Local Build & Validation

### 1. Reproducible Dependency Installation
```bash
yarn install --immutable
```

### 2. Medusa Application Build
Builds the TypeScript backend and Vite admin frontend:
```bash
yarn build
```

### 3. Wrangler Configuration Validation
Validates `wrangler.jsonc` and regenerates types:
```bash
yarn wrangler types
```

---

## 6. Local Docker Build & Testing

### 1. Build the Docker Image Locally
```bash
docker build -t arohahouse-medusa-cloudflare .
```

### 2. Run the Container Locally
```bash
docker run --rm \
  --env-file .env \
  -p 9000:9000 \
  arohahouse-medusa-cloudflare
```

### 3. Verify Health & Admin
* Health Check: `curl http://localhost:9000/health` (Returns `200 OK`)
* Medusa Admin: Open `http://localhost:9000/app` in browser.

---

## 7. Cloudflare Deployment (When Approved)

> [!CAUTION]
> Do not execute deployment until explicitly approved.
> The existing Render deployment (`render.yaml`) remains untouched and fully operational.

When ready to deploy:

```bash
# 1. Login to Cloudflare
yarn wrangler login

# 2. Deploy the Worker and Container image
yarn wrangler deploy
```

---

## 8. Custom Domain & DNS Setup

To route your production domain (e.g., `api.arohahouse.com`) to the Cloudflare Worker:

1. Open **Cloudflare Dashboard** > **Workers & Pages** > `backend-arohahouse`.
2. Navigate to **Settings** > **Domains & Routes**.
3. Add **Custom Domain**: `api.arohahouse.com`.
4. Ensure CORS settings (`ADMIN_CORS`, `STORE_CORS`, `AUTH_CORS`) match your domains.

---

## 9. Rollback & Disaster Recovery

* **Immediate Rollback**: In Cloudflare Dashboard > `backend-arohahouse` > **Deployments**, rollback to any previous version with a single click.
* **Preserved Render Deployment**: The existing `render.yaml` configuration is completely preserved on `main`. If you ever need to revert to Render, the repository continues to build and run on Render without modifications.

---

## 10. Future Server/Worker Split (Scaling)

In the current setup, `MEDUSA_WORKER_MODE=shared` runs both the HTTP API server and subscriber/workflow processing inside a single container instance (`standard-1`).

If traffic or background workload increases significantly in the future:
1. Deploy an **API Container** with `MEDUSA_WORKER_MODE=server` (scales horizontally with incoming HTTP traffic).
2. Deploy a **Worker Container** with `MEDUSA_WORKER_MODE=worker` (handles queue/subscribers without exposing HTTP ports).
3. Connect both containers to an external Redis instance (`REDIS_URL`) for shared event dispatch and workflow queueing.
