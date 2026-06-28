# MindAnchor — Setup & Self-Hosting Guide

This guide is for anyone who clones MindAnchor and wants to **run it locally** or
**deploy it to their own Google Cloud project**. It assumes no prior knowledge of
the repo. For the maintainer's live environment specifics, see [`docs/DEPLOY.md`](docs/DEPLOY.md).

> MindAnchor is a single-user system. Each person runs their **own** instance
> (their own DB, their own auth, their own optional Claude key). There is no
> shared multi-tenant server.

---

## 1. What you need

| Tool | Why | Notes |
|---|---|---|
| Docker + Docker Compose | Easiest local run (all 3 services) | Recommended path |
| Python 3.11 | Backend without Docker | Pinned deps target 3.11 |
| Node 20+ | Frontend without Docker | |
| A Postgres DB | Persistence | Local container or managed (Cloud SQL, etc.) |
| Anthropic API key | Real AI (optional) | Omit → deterministic offline stubs |

Nothing here is GCP-specific until you choose to deploy to GCP. The app runs on
any host that can serve a container + Postgres.

---

## 2. Run locally (Docker — recommended)

```bash
git clone https://github.com/OwnYourSystem/MindAnchor.git
cd MindAnchor
docker compose up --build
# frontend → http://localhost:8080   backend → http://localhost:8000
```

`docker-compose.yml` starts Postgres, the FastAPI backend (which runs Alembic
migrations on startup), and the nginx-served frontend that proxies `/api/` to the
backend. Set `ANTHROPIC_API_KEY` in the `backend` service environment to enable
real Claude; leave it unset for offline stubs.

## 3. Run locally (without Docker)

```bash
# Backend — needs a reachable Postgres and backend/.env (see docs/DATABASE.md)
cd backend
python -m venv .venv && . .venv/bin/activate      # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env                               # fill DATABASE_URL, JWT_SECRET, etc.
python scripts/init_db.py                          # or: alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev          # http://localhost:5173 (proxies /api → :8000)
```

Backend tests need no DB (in-memory SQLite): `cd backend && pytest -q`.

---

## 4. Configuration (environment variables)

Set on the **backend** service. Never commit real values — `backend/.env` is
gitignored; `backend/.env.example` is the template.

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | e.g. `postgresql+psycopg2://user:pwd@host:5432/db`. A bare `postgres://` is auto-normalized. |
| `JWT_SECRET` | yes | Token signing secret (`openssl rand -base64 48`). |
| `PASSWORD_HASH` | yes (prod) | bcrypt hash of your owner password. |
| `ANTHROPIC_API_KEY` | no | Enables real Claude; omit for offline stubs. |
| `CORS_ORIGINS` | no | Comma-separated or JSON list; empty = none. |

Generate a password hash:
```bash
python -c "import bcrypt; print(bcrypt.hashpw(b'YOUR_PASSWORD', bcrypt.gensalt(12)).decode())"
```

---

## 5. Deploy to your own Google Cloud

The repo ships everything needed to reproduce the maintainer's topology in **your**
GCP project (two Cloud Run services + Cloud SQL):

- `backend/Dockerfile` — backend image (runs migrations on startup).
- `frontend/Dockerfile` + `frontend/nginx.conf` — frontend image (nginx proxies `/api/` → backend).
- `frontend/cloudbuild.yaml` — Cloud Build pipeline for the frontend.
- `deploy/cloudsql-setup.sh` — one-shot infra bootstrap (APIs, Cloud SQL, Secret Manager, Artifact Registry, IAM).
- `deploy/cloudrun.yaml` — Cloud Run service manifest reference.

High-level steps (full runbook in [`docs/DEPLOY.md`](docs/DEPLOY.md)):

1. Set `PROJECT_ID`/region, then run `deploy/cloudsql-setup.sh` to provision infra.
2. Deploy the backend: `gcloud run deploy mindanchor --source backend --region <region>`.
3. Deploy the frontend with the backend URL injected:
   ```bash
   BACKEND=<your-backend>.run.app
   gcloud run deploy mindanchor-frontend --source frontend --port 8080 --allow-unauthenticated \
     --set-env-vars "BACKEND_ORIGIN=https://${BACKEND},BACKEND_HOST=${BACKEND}"
   ```
4. (Optional) Wire auto-deploy triggers so pushes to `main` deploy automatically —
   backend trigger + the frontend trigger (`gcloud builds triggers create ... --build-config=frontend/cloudbuild.yaml`).

You can also deploy the same containers to any other host (Render, Railway, Fly,
a VM) — only the orchestration differs; the images are standard.

---

## 6. Contributing / fork workflow

- The GitHub repo is the single source of truth. Make changes on a branch and
  open a PR into `main`.
- Keep it generic: no secrets, no machine-specific absolute paths.
- CI runs ruff + pytest (backend) and the Vite build (frontend) — keep them green.
- Forkers: clone, point the env vars at your own infra, deploy to your own project.
