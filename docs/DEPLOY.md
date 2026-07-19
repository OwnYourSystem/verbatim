# Verbatim — Deployment Guide

> **Status: NOT YET DEPLOYED.** Verbatim is forked from MindAnchor (which runs this exact runbook against its own GCP project) but has no GCP project of its own provisioned yet. Everything below is the runbook to follow once `<VERBATIM_GCP_PROJECT_ID>` exists — replace every `<VERBATIM_...>` placeholder in this doc as you provision each piece.
> This supersedes the earlier Render/Vercel/Railway plans.

![Verbatim architecture](architecture.jpg)

## Live URLs

| Surface | URL |
|---|---|
| **Web app (use this)** | *(pending)* `https://<VERBATIM_FRONTEND_RUN_URL>` |
| Backend API | *(pending)* `https://<VERBATIM_BACKEND_RUN_URL>` |
| API docs (OpenAPI UI) | *(pending)* `https://<VERBATIM_BACKEND_RUN_URL>/docs` |

The backend root (`/`) returns `{"app":"Verbatim","version":"0.1.0","status":"ok"}` —
that is the API answering correctly, not an error. The browsable app is the **frontend** URL.

---

## Topology

Two Cloud Run services + one Cloud SQL instance, all in `europe-north2`:

```
User ──HTTPS──► verbatim-frontend (Cloud Run)        ── CI/CD ──
                React SPA served by nginx              GitHub main ─► Cloud Build
                  │  nginx proxies /api/ ─┐                          │ build backend/Dockerfile
                  ▼                       │                          ▼
                verbatim (Cloud Run)  ◄─┘                     Artifact Registry
                FastAPI + uvicorn                                    │ deploy image
                  │                                                  ▼
                  ▼                                              verbatim (Cloud Run)
                Cloud SQL — PostgreSQL (verbatim-db)
                  │
                Anthropic Claude (optional, on user events)
```

Because the frontend's nginx proxies `/api/` to the backend **server-side**, the
browser only ever talks to one origin — there is no cross-origin (CORS) hop in
the normal request path.

---

## Components

| Component | GCP resource | Notes |
|---|---|---|
| Frontend | Cloud Run `verbatim-frontend` | React+Vite SPA built to static, served by nginx; `port 8080`, public |
| Backend | Cloud Run `verbatim` | FastAPI/uvicorn; `port 8080`, 1Gi memory, public |
| Database | Cloud SQL `verbatim-db` (PostgreSQL) | connected via the Cloud SQL connector socket |
| Images | Artifact Registry `cloud-run-source-deploy` | Docker images, tagged by commit SHA |
| CI/CD | Cloud Build trigger `<VERBATIM_CLOUD_BUILD_TRIGGER_ID>` | fires on push to `OwnYourSystem/verbatim` `main` |

---

## CI/CD — how a deploy happens

The Cloud Build trigger watches `main` and runs three steps
(`docker build backend -f backend/Dockerfile` → push → `gcloud run services update`):

1. **Build** the backend image from `backend/Dockerfile`, tagged `:$COMMIT_SHA`.
2. **Push** it to Artifact Registry.
3. **Deploy** by updating the `verbatim` Cloud Run service to that image.

The deploy step **only swaps the image** — it does not touch env vars or memory,
so runtime configuration persists across deploys.

> The **frontend has no trigger yet** — it is deployed manually (see below). Wire a
> second trigger if you want `frontend/` changes to auto-deploy too.

---

## Backend — runtime configuration (Cloud Run env vars)

Set on the `verbatim` service; persist across auto-deploys.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://verbatim:<pwd>@/verbatim?host=/cloudsql/<VERBATIM_GCP_PROJECT_ID>:europe-north2:verbatim-db` |
| `JWT_SECRET` | JWT signing secret |
| `PASSWORD_HASH` | bcrypt hash of the owner password |
| `ANTHROPIC_API_KEY` | Claude API key (omit → offline stub) |
| `CORS_ORIGINS` | comma-separated or JSON list; empty = none |

The Cloud Run service account needs `roles/cloudsql.client` to reach Cloud SQL.

### Set / rotate the owner password

```bash
# 1. generate a bcrypt hash
python -c "import bcrypt; print(bcrypt.hashpw(b'NEW_PASSWORD', bcrypt.gensalt(12)).decode())"

# 2. update the service (^@^ delimiter avoids issues with $ in the hash)
gcloud run services update verbatim --project <VERBATIM_GCP_PROJECT_ID> --region europe-north2 \
  --update-env-vars '^@^PASSWORD_HASH=<hash-from-step-1>'
```

---

## Manual deploys (when needed)

### Backend (normally automatic via the trigger)

```bash
# Re-run the trigger's pipeline for the current main, or build+deploy by hand:
gcloud run deploy verbatim --project <VERBATIM_GCP_PROJECT_ID> --region europe-north2 \
  --source backend
```

### Frontend (currently manual)

The frontend image is env-driven so the API upstream is injectable at deploy time:

```bash
BACKEND=<VERBATIM_BACKEND_RUN_URL>
gcloud run deploy verbatim-frontend --project <VERBATIM_GCP_PROJECT_ID> --region europe-north2 \
  --source frontend --port 8080 --allow-unauthenticated \
  --set-env-vars "BACKEND_ORIGIN=https://${BACKEND},BACKEND_HOST=${BACKEND}"
```

`frontend/nginx.conf` is an nginx template expanded at container start via envsubst
(`PORT`, `BACKEND_ORIGIN`, `BACKEND_HOST`). Locally, `docker-compose` supplies the
same vars pointing at the `backend` service.

---

## Database

- Instance: `verbatim-db` (PostgreSQL, `europe-north2`), database `verbatim`, user `verbatim`.
- **Migrations run automatically** on backend startup (Alembic, inside the FastAPI
  lifespan hook — see `backend/app/main.py`). No manual `alembic upgrade` needed on deploy.
- Connect for inspection with the Cloud SQL Auth Proxy:
  ```bash
  cloud-sql-proxy <VERBATIM_GCP_PROJECT_ID>:europe-north2:verbatim-db
  psql "host=127.0.0.1 dbname=verbatim user=verbatim"
  ```

---

## Local development

```bash
# Backend (needs local Postgres + backend/.env — see DATABASE.md)
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev    # http://localhost:5173

# Or the whole stack with Docker:
docker compose up --build                    # frontend :80, backend :8080, postgres
```

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Container "failed to start and listen on PORT=8080" | App crashed at startup — check `gcloud run services logs read verbatim`. A common past cause was an empty/invalid `CORS_ORIGINS` (now hardened with `NoDecode` in config). |
| Cloud SQL `403 … cloudsql.instances.get` | Grant the Cloud Run service account `roles/cloudsql.client`. |
| `gcloud run deploy --source` `403 storage.objects.get` | Grant the build service account `roles/cloudbuild.builds.builder`, `roles/storage.objectViewer`, `roles/artifactregistry.writer`. |
| Browser shows JSON `{"app":"Verbatim",…}` | You opened the **backend** URL — open the **frontend** URL instead. |
