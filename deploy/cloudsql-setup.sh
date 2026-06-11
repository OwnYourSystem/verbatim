#!/usr/bin/env bash
# One-time Cloud SQL + Secret Manager setup.
# Run this once from your local machine with gcloud authenticated.
# Replace PROJECT_ID and REGION before running.
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
INSTANCE="mindanchor-db"
DB_NAME="mindanchor"
DB_USER="mindanchor"

echo "=== 1. Enable required APIs ==="
gcloud services enable \
  sqladmin.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  --project "$PROJECT_ID"

echo "=== 2. Create Cloud SQL Postgres instance ==="
gcloud sql instances create "$INSTANCE" \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time=03:00 \
  --project "$PROJECT_ID"

echo "=== 3. Create database and user ==="
gcloud sql databases create "$DB_NAME" --instance="$INSTANCE" --project "$PROJECT_ID"
DB_PASSWORD=$(openssl rand -base64 24)
gcloud sql users create "$DB_USER" \
  --instance="$INSTANCE" \
  --password="$DB_PASSWORD" \
  --project "$PROJECT_ID"

SOCKET_PATH="/cloudsql/${PROJECT_ID}:${REGION}:${INSTANCE}"
DB_URL="postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=${SOCKET_PATH}"

echo "=== 4. Store secrets in Secret Manager ==="
echo -n "$DB_URL" | gcloud secrets create mindanchor-db-url \
  --data-file=- --project "$PROJECT_ID"

JWT_SECRET=$(openssl rand -base64 48)
echo -n "$JWT_SECRET" | gcloud secrets create mindanchor-jwt-secret \
  --data-file=- --project "$PROJECT_ID"

# ANTHROPIC_API_KEY — set manually after running this script:
# echo -n "sk-ant-..." | gcloud secrets create mindanchor-anthropic-key --data-file=- --project "$PROJECT_ID"

# CORS_ORIGINS — update after Vercel deploy gives you the URL:
echo -n "https://mindanchor.vercel.app" | gcloud secrets create mindanchor-cors-origins \
  --data-file=- --project "$PROJECT_ID"

echo "=== 5. Create Artifact Registry repo ==="
gcloud artifacts repositories create mindanchor \
  --repository-format=docker \
  --location="$REGION" \
  --project "$PROJECT_ID"

echo "=== 6. Create service account for Cloud Run ==="
SA="mindanchor-api@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create mindanchor-api \
  --display-name="MindAnchor API" \
  --project "$PROJECT_ID"

# Grant Cloud SQL client + Secret Manager accessor
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/cloudsql.client"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}" \
  --role="roles/secretmanager.secretAccessor"

# Grant CI service account (GitHub Actions via Workload Identity) push + deploy
echo ""
echo "=== Done! Next steps ==="
echo "1. Add ANTHROPIC_API_KEY secret:"
echo "   echo -n 'sk-ant-...' | gcloud secrets create mindanchor-anthropic-key --data-file=- --project $PROJECT_ID"
echo ""
echo "2. Set GitHub Actions secrets (see docs/DEPLOY.md)"
echo ""
echo "3. Run the first migration:"
echo "   cd backend && DATABASE_URL='$DB_URL' alembic upgrade head"
echo "   (or use Cloud SQL Auth Proxy locally)"
echo ""
echo "4. Push to main to trigger the full CI/CD pipeline."
