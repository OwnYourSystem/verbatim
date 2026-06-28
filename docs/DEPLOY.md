# MindAnchor — Deployment Guide

> **Status: LIVE on Google Cloud** (project `mindanchor-500313`, region `europe-north2`).
> This supersedes the earlier Render/Vercel/Railway plans.

![MindAnchor architecture](architecture.jpg)

## Live URLs

| Surface | URL |
|---|---|
| **Web app (use this)** | https://mindanchor-frontend-2814170686.europe-north2.run.app |
| Backend API | https://mindanchor-p56twm4tsa-ma.a.run.app |
| API docs (OpenAPI UI) | https://mindanchor-p56twm4tsa-ma.a.run.app/docs |

The backend root (`/`) returns `{"app":"MindAnchor","version":"0.1.0","status":"ok"}` —
that is the API answering correctly, not an error. The browsable app is the **frontend** URL.

---

## Topology

Two Cloud Run services + one Cloud SQL instance, all in `europe-north2`:

```
User ──HTTPS──► mindanchor-frontend (Cloud Run)        ── CI/CD ──
                React SPA served by nginx              GitHub main ─► Cloud Build
                  │  nginx proxies /api/ ─┐                          │ build backend/Dockerfile
                  ▼                       │                          ▼
                mindanchor (Cloud Run)  ◄─┘                     Artifact Registry
                FastAPI + uvicorn                                    │ deploy image
                  │                                                  ▼
                  ▼                                              mindanchor (Cloud Run)
                Cloud SQL — PostgreSQL (mindanchor-db)
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
| Frontend | Cloud Run `mindanchor-frontend` | React+Vite SPA built to static, served by nginx; `port 8080`, public |
| Backend | Cloud Run `mindanchor` | FastAPI/uvicorn; `port 8080`, 1Gi memory, public |
| Database | Cloud SQL `mindanchor-db` (PostgreSQL) | connected via the Cloud SQL connector socket |
| Images | Artifact Registry `cloud-run-source-deploy` | Docker images, tagged by commit SHA |
| CI/CD | Cloud Build trigger `668357f1-…` | fires on push to `OwnYourSystem/MindAnchor` `main` |

---

## CI/CD — how a deploy happens

The Cloud Build trigger watches `main` and runs three steps
(`docker build backend -f backend/Dockerfile` → push → `gcloud run services update`):

1. **Build** the backend image from `backend/Dockerfile`, tagged `:$COMMIT_SHA`.
2. **Push** it to Artifact Registry.
3. **Deploy** by updating the `mindanchor` Cloud Run service to that image.

The deploy step **only swaps the image** — it does not touch env vars or memory,
so runtime configuration persists across deploys.

> ⚠ The trigger deploys the **backend only**. The **frontend has no trigger yet** —
> it is deployed manually (see below). So **frontend changes do not go live on a
> push/merge to `main`**; you must run the manual frontend deploy. Wire a second
> trigger if you want `frontend/` changes to auto-deploy too.

> ⚠ **Deploy order matters across breaking API changes.** The frontend assumes the
> backend's current response shape. When a change touches both (e.g. CR-2's SK
> `rating`/`specific_knowledges`), let the **backend** deploy first (merge to
> `main` → auto-deploy → migrations run on startup), then deploy the **frontend**.

---

## Backend — runtime configuration (Cloud Run env vars)

Set on the `mindanchor` service; persist across auto-deploys.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://mindanchor:<pwd>@/mindanchor?host=/cloudsql/mindanchor-500313:europe-north2:mindanchor-db` |
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
gcloud run services update mindanchor --project mindanchor-500313 --region europe-north2 \
  --update-env-vars '^@^PASSWORD_HASH=<hash-from-step-1>'
```

---

## Manual deploys (when needed)

### Backend (normally automatic via the trigger)

```bash
# Re-run the trigger's pipeline for the current main, or build+deploy by hand:
gcloud run deploy mindanchor --project mindanchor-500313 --region europe-north2 \
  --source backend
```

### Frontend (currently manual — required for any frontend change to go live)

The frontend image is env-driven so the API upstream is injectable at deploy time:

```bash
BACKEND=mindanchor-p56twm4tsa-ma.a.run.app
gcloud run deploy mindanchor-frontend --project mindanchor-500313 --region europe-north2 \
  --source frontend --port 8080 --allow-unauthenticated \
  --set-env-vars "BACKEND_ORIGIN=https://${BACKEND},BACKEND_HOST=${BACKEND}"
```

`frontend/nginx.conf` is an nginx template expanded at container start via envsubst
(`PORT`, `BACKEND_ORIGIN`, `BACKEND_HOST`). Locally, `docker-compose` supplies the
same vars pointing at the `backend` service.

---

## Database

- Instance: `mindanchor-db` (PostgreSQL, `europe-north2`), database `mindanchor`, user `mindanchor`.
- **Migrations run automatically** on backend startup (Alembic, inside the FastAPI
  lifespan hook — see `backend/app/main.py`). No manual `alembic upgrade` needed on deploy.
- Connect for inspection with the Cloud SQL Auth Proxy:
  ```bash
  cloud-sql-proxy mindanchor-500313:europe-north2:mindanchor-db
  psql "host=127.0.0.1 dbname=mindanchor user=mindanchor"
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
| Frontend changes not showing after merge | The frontend has **no auto-deploy trigger** — run the manual frontend deploy above. A merge to `main` only redeploys the backend. |
| Container "failed to start and listen on PORT=8080" | App crashed at startup — check `gcloud run services logs read mindanchor`. A common past cause was an empty/invalid `CORS_ORIGINS` (now hardened with `NoDecode` in config). |
| Cloud SQL `403 … cloudsql.instances.get` | Grant the Cloud Run service account `roles/cloudsql.client`. |
| `gcloud run deploy --source` `403 storage.objects.get` | Grant the build service account `roles/cloudbuild.builds.builder`, `roles/storage.objectViewer`, `roles/artifactregistry.writer`. |
| Browser shows JSON `{"app":"MindAnchor",…}` | You opened the **backend** URL — open the **frontend** URL instead. |

---

> **Note on repo vs. live infra (2026-06-28):** the live deployment is on Google
> Cloud as described above. The repo also still contains earlier-plan config —
> `render.yaml` and `frontend/vercel.json` — which are **stale** and not used by
> the live GCP deploy. The frontend Cloud Run image referenced here
> (`frontend/nginx.conf`, a frontend `Dockerfile`, root `docker-compose.yml`) is
> built from infra not yet committed to this repo; commit it if you want the
> frontend build reproducible from source. `deploy/cloudrun.yaml` and
> `deploy/cloudsql-setup.sh` capture the GCP setup.
