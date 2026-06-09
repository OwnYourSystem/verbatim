# MindAnchor — Backend

FastAPI service. Phase 1 is a runnable skeleton (health endpoints). Data models, CRUD, and the agent layer come next.

## Setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # then edit .env
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

- API root: http://localhost:8000/
- Health: http://localhost:8000/health
- Interactive docs: http://localhost:8000/docs

## Test & lint

```bash
pytest
ruff check .
```

## Database (Google Cloud SQL)

We use Cloud SQL for PostgreSQL. For local development you have two options:

1. **Cloud SQL Auth Proxy** — connect to the real Cloud SQL instance over localhost.
2. **Local Postgres** — run Postgres locally and point `DATABASE_URL` at it.

GCP setup is documented in `docs/` when Phase 2 (data model) lands.
