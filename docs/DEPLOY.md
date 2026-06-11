# MindAnchor — Deployment Guide

## Architecture

```
GitHub (main) ──► GitHub Actions CI/CD
                      │
          ┌───────────┼───────────────────┐
          ▼           ▼                   ▼
      pytest      Docker build        npm build
      ruff lint   + push to AR        (Vite + PWA SW)
          │           │                   │
          └───────────┼───────────────────┘
                      │
               ┌──────┴──────┐
               ▼             ▼
         Cloud Run       Vercel
         (FastAPI)      (React PWA)
               │
          Cloud SQL
          (PostgreSQL 15)
               │
      Secret Manager
      (DB URL, JWT, API key)
```

## One-time setup

### Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI authenticated (`gcloud auth login`)
- Vercel account + Vercel CLI
- GitHub repo secrets configured (see below)

### 1. Google Cloud infrastructure

```bash
export PROJECT_ID=your-gcp-project-id
export REGION=europe-west1   # or us-central1, etc.

cd deploy
bash cloudsql-setup.sh
```

This script creates:
- Cloud SQL Postgres 15 instance (`mindanchor-db`, db-f1-micro ~$7/mo)
- Database + user with a randomly generated password
- All secrets in Secret Manager
- Artifact Registry repo for Docker images
- Service account with least-privilege IAM roles

Then add the Anthropic API key manually:
```bash
echo -n "sk-ant-..." | gcloud secrets create mindanchor-anthropic-key \
  --data-file=- --project "$PROJECT_ID"
```

### 2. Workload Identity Federation (keyless GitHub Actions auth)

```bash
# Create the pool
gcloud iam workload-identity-pools create github-pool \
  --location=global --project "$PROJECT_ID"

POOL_ID=$(gcloud iam workload-identity-pools describe github-pool \
  --location=global --project "$PROJECT_ID" \
  --format="value(name)")

# Create the provider
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --project "$PROJECT_ID"

# Allow the GitHub repo to impersonate the service account
SA="mindanchor-api@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/OwnYourSystem/MindAnchor" \
  --project "$PROJECT_ID"

# Get the provider resource name for GitHub secrets
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --project "$PROJECT_ID" \
  --format="value(name)"
```

### 3. Vercel project setup

```bash
cd frontend
npx vercel login
npx vercel link        # creates .vercel/project.json
npx vercel env add VITE_API_URL   # set to Cloud Run URL after first deploy
```

After first Cloud Run deploy, update `frontend/vercel.json`:
```json
"destination": "https://mindanchor-api-ACTUAL_HASH.a.run.app/:path*"
```

### 4. GitHub Actions secrets

Go to GitHub → Settings → Secrets and variables → Actions and add:

| Secret | Value |
|---|---|
| `GCP_PROJECT_ID` | Your GCP project ID |
| `GCP_REGION` | `europe-west1` (or your chosen region) |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Provider resource name from step 2 |
| `GCP_SERVICE_ACCOUNT` | `mindanchor-api@PROJECT_ID.iam.gserviceaccount.com` |
| `VERCEL_TOKEN` | From vercel.com → Account Settings → Tokens |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after `vercel link` |
| `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |

### 5. First deploy

```bash
git push origin main
```

GitHub Actions will:
1. Run backend lint + tests
2. Build frontend (Vite + PWA service worker)
3. Build Docker image and push to Artifact Registry
4. Deploy to Cloud Run (runs `alembic upgrade head` as a Cloud Run Job)
5. Deploy frontend to Vercel

## Local development

```bash
# Backend
cd backend
cp .env.example .env          # fill in DATABASE_URL, ANTHROPIC_API_KEY
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev                   # http://localhost:5173

# Run migrations locally
cd backend
alembic upgrade head
```

## Running migrations manually

```bash
# Against local Postgres
cd backend
DATABASE_URL=postgresql+psycopg2://mindanchor:mindanchor@localhost/mindanchor \
  alembic upgrade head

# Against Cloud SQL via Auth Proxy
cloud-sql-proxy PROJECT_ID:REGION:mindanchor-db &
DATABASE_URL=postgresql+psycopg2://mindanchor:PASSWORD@localhost/mindanchor \
  alembic upgrade head
```

## Cost estimate

| Resource | Spec | ~Cost/mo |
|---|---|---|
| Cloud SQL | db-f1-micro, 10 GB SSD | ~$7 |
| Cloud Run | Scale-to-zero, 512 MB | ~$0–3 |
| Artifact Registry | Docker images | ~$0.10 |
| Secret Manager | 5 secrets | ~$0.03 |
| Vercel | Hobby (free) | $0 |
| **Total** | | **~$8–10/mo** |

## Environment variables reference

| Variable | Where set | Description |
|---|---|---|
| `DATABASE_URL` | Secret Manager | Full Postgres connection string with Cloud SQL socket path |
| `JWT_SECRET` | Secret Manager | Random 48-byte string for JWT signing |
| `ANTHROPIC_API_KEY` | Secret Manager | Claude API key |
| `CORS_ORIGINS` | Secret Manager | Comma-separated Vercel URLs |
| `ENVIRONMENT` | Cloud Run env var | `production` |
| `EXPO_PUBLIC_API_URL` | Mobile .env.local | Cloud Run URL for RN app |
