# Database — local development & production

**Decision (D4):** develop against **local PostgreSQL**; provision **Google Cloud SQL (PostgreSQL)** at deploy time. Same engine, so the schema and queries are identical across environments.

---

## Local development (now)

### 1. Run Postgres locally

Pick whichever you prefer:

**Docker (simplest):**
```bash
docker run --name mindanchor-pg -e POSTGRES_USER=mindanchor \
  -e POSTGRES_PASSWORD=mindanchor -e POSTGRES_DB=mindanchor \
  -p 5432:5432 -d postgres:16
```

**Native install:** install PostgreSQL 16, then create the role/db:
```sql
CREATE USER mindanchor WITH PASSWORD 'mindanchor';
CREATE DATABASE mindanchor OWNER mindanchor;
```

### 2. Point the app at it

`backend/.env`:
```
DATABASE_URL=postgresql+psycopg2://mindanchor:mindanchor@localhost:5432/mindanchor
```

### 3. Create the schema

Dev convenience (creates tables directly):
```bash
cd backend
python scripts/init_db.py
```

Or, the production-style path with Alembic:
```bash
cd backend
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

> Note: `requirements.txt` includes `psycopg2-binary`. The automated test suite
> uses in-memory SQLite and does **not** require Postgres.

---

## Production (at deploy time) — Google Cloud SQL

Outline (commands finalized in the deploy phase):

1. Create a Cloud SQL for PostgreSQL instance.
   ```bash
   gcloud sql instances create mindanchor-db \
     --database-version=POSTGRES_16 --tier=db-f1-micro --region=europe-west1
   gcloud sql databases create mindanchor --instance=mindanchor-db
   gcloud sql users create mindanchor --instance=mindanchor-db --password=...
   ```
2. Connect from the backend via the **Cloud SQL Auth Proxy** (local/dev-against-cloud) or a **Unix socket** (Cloud Run).
3. Set `DATABASE_URL` as a secret in the hosting platform.
4. Run `alembic upgrade head` as part of the release.

This is intentionally deferred — we build and test locally first.
