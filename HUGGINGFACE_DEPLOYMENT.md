# Deploying Medusa v2 Backend to Hugging Face Spaces (100% Free)

Hugging Face Spaces provides a **free Docker runtime with 2 vCPUs and 16 GB RAM**, making it ideal for running Medusa v2 with zero hosting cost.

---

## 🚀 Step 1: Create a Space on Hugging Face

1. Go to [huggingface.co/new-space](https://huggingface.co/new-space).
2. Set your Space details:
   - **Space name**: `arohahouse-backend` (or your preferred name)
   - **License**: `mit` / `apache-2.0`
   - **Space SDK**: Select **Docker** → **Blank**
   - **Space Hardware**: **CPU basic • 2 vCPU • 16 GB • FREE**
   - **Privacy**: **Public** (or **Private** depending on your preference)
3. Click **Create Space**.

---

## 🔑 Step 2: Add Environment Variables (Secrets)

In your Hugging Face Space:
1. Go to **Settings** → **Variables and secrets**.
2. Under **Secrets**, add the following from your `.env.server` file:

| Secret Name | Description |
| :--- | :--- |
| `DATABASE_URL` | Neon PostgreSQL SSL connection string |
| `REDIS_URL` | Upstash Redis connection string (Optional) |
| `JWT_SECRET` | Medusa authentication secret |
| `COOKIE_SECRET` | Cookie signing secret |
| `MEDUSA_BACKEND_URL` | Your Space direct URL (e.g., `https://<user>-<space>.hf.space`) |
| `STORE_CORS` | `https://arohahouse.com,http://localhost:8000` |
| `ADMIN_CORS` | `https://<user>-<space>.hf.space,http://localhost:9000` |
| `AUTH_CORS` | `https://arohahouse.com,http://localhost:8000` |
| `S3_URL` | Cloudflare R2 bucket endpoint |
| `S3_BUCKET` | R2 bucket name |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | Cloudflare R2 access key ID |
| `S3_SECRET_ACCESS_KEY` | Cloudflare R2 secret access key |
| `RESEND_API_KEY` | Resend email API key |
| `RESEND_FROM_EMAIL` | Sender email address |
| `SANITY_PROJECT_ID` | Sanity studio project ID |
| `SANITY_DATASET` | `production` |
| `SANITY_API_TOKEN` | Sanity API token |

---

## 📦 Step 3: Deploy Your Code

### Option A: Push Directly via Git (Easiest)

Hugging Face gives you a Git remote URL for your Space:

```bash
# Add Hugging Face Space as a git remote
git remote add hf https://huggingface.co/spaces/<YOUR_HF_USERNAME>/<SPACE_NAME>

# Push your code to Hugging Face
git push hf cloudflare-container:main --force
```

### Option B: Automatic GitHub Sync (GitHub Actions)

Add a GitHub Actions workflow in `.github/workflows/deploy-hf.yml` to automatically sync changes from GitHub to your Hugging Face Space on every push.
