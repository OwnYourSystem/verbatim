# CLAUDE.md — MindAnchor project guide & action log

This file is the working memory for the MindAnchor build. It records **what the project is**, **the decisions made**, and a **chronological log of every action taken**. Update the action log on every meaningful change.

---

## ▶ Resume here (read this first)

**Status:** Phase 1 (scaffold) and Phase 2 (data model & CRUD) are **done, committed, pushed** to `origin/main`. Working tree clean.

**Do next:** **Phase 3 — Dashboard, Calendar & rule-based Daily Focus.** Build the frontend (add/edit Systems→Tasks→Subtasks, set monthly priorities), a dashboard (today's focus, deadlines, flags), the live calendar, a deterministic (non-AI) daily-focus algorithm, and the end-of-day check-in. Goal: the app becomes usable end-to-end. (Part B / AI brain comes after.)

**How to run & test (Windows, network-share repo):**
- Backend API: `cd backend` → `uvicorn app.main:app --reload --port 8000` (needs deps installed + `.env`).
- Frontend: `cd frontend` → `npm install` → `npm run dev` (http://localhost:5173, proxies `/api` → `:8000`).
- Backend tests use **in-memory SQLite — no live DB needed**.

**⚠ Environment gotchas (learned the hard way — don't repeat):**
- **Do NOT build the Python venv on the network share** and do not run `pip install --upgrade pip` there — it corrupts pip mid-write (`pip._vendor.rich` ModuleNotFoundError). Build the venv on **local disk**.
- The working test venv is at `%LOCALAPPDATA%\Temp\mindanchor-venv` (Python 3.14). It may be gone tomorrow (temp dir) — if so, recreate on local disk.
- Local Python is **3.14**, which has **no wheels** for the pinned dep versions (pydantic-core fails to build). For local testing, `pip install -U fastapi pydantic pydantic-settings sqlalchemy httpx pytest ruff` (latest, has cp314 wheels). **CI and deploy use the pinned `requirements.txt` on Python 3.11** — keep the pins as-is.
- Run lint+tests: `cd backend` then `<localvenv>\Scripts\python.exe -m ruff check .` and `... -m pytest -q`. Last run: ruff clean, 6 passed.
- For Phase 3+ DB work locally: start Postgres (Docker one-liner in `docs/DATABASE.md`), set `backend/.env` `DATABASE_URL`, then `python scripts/init_db.py`.

**Convention:** end every phase with a `CLAUDE.md` action-log update + commit + push.

---

## Project

MindAnchor — a personal, single-user AI productivity system (AI project manager + scrum master + calendar + morning briefing). Source of truth for product scope: [`MindAnchor_Product_Description.md`](../MindAnchor_Product_Description.md). Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

- **GitHub**: https://github.com/OwnYourSystem/MindAnchor (private, account `OwnYourSystem`)
- **Local path**: `…/Calude_projects/.starter/MindAnchor` (network share)

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Agent execution model | **Event-triggered specialist agents** (one per System/cluster), not continuous loops |
| D2 | Build sequencing | **Skeleton-first** — usable manual tool before any AI |
| D3 | Rebalancing policy | **Propose → approve** — AI never auto-reorganizes |
| D4 | Database | **Google Cloud SQL (PostgreSQL)** in production; **local Postgres for development** (provision Cloud SQL at deploy time) |
| D5 | Frontend | React + TS + Vite + Tailwind, **PWA** (installable on mobile) |
| D6 | Backend | FastAPI + SQLAlchemy + Alembic |
| D7 | AI | Anthropic Claude — Opus (`claude-opus-4-8`) for planning, Sonnet (`claude-sonnet-4-6`) for fast calls |
| D8 | Auth | Single-user JWT |
| D9 | Mobile | PWA first; React Native (Expo) in a later phase |

## Roadmap

- **Part A — usable skeleton (no AI):** 1) Scaffold ✅ · 2) Data model & CRUD · 3) Dashboard, calendar & rule-based daily focus
- **Part B — AI brain:** 4) Orchestrator + specialist agents · 5) Dynamic rebalancing (propose→approve) · 6) AI intake interview · 7) Reports & push
- **Part C — mobile:** 8) PWA polish + RN scaffold

## Conventions

- Update **this action log** with every meaningful change (file created, decision made, command run that changes state, commit/push).
- Commit messages: `Phase N: <summary>`.
- Never commit secrets; `.env` is gitignored, `.env.example` is the template.

---

## Action log

### 2026-06-09

- Created GitHub repo `OwnYourSystem/MindAnchor` (private) via `gh` CLI; cloned locally.
- **Phase 1 — scaffold** committed & pushed (`main`, commit `c684f48`):
  - Monorepo layout: `frontend/`, `backend/`, `mobile/`, `docs/`.
  - Backend: FastAPI skeleton (`/`, `/health`), `app/core/config.py` (env-driven settings), `requirements.txt`, `pyproject.toml` (ruff+pytest), smoke tests in `tests/test_health.py`, `.env.example`, `README.md`. Python compile-checked OK.
  - Frontend: React+TS+Vite+Tailwind **PWA** (`vite.config.ts` with `vite-plugin-pwa`, `/api` proxy to `:8000`), landing page with live backend health check, `README.md`.
  - CI: `.github/workflows/ci.yml` — backend lint+test, frontend build.
  - Docs: `docs/ARCHITECTURE.md` (design + ADR-style decision table).
  - Root `README.md`, `.gitignore`.
- Decision **D4** refined: develop against **local Postgres**, provision Cloud SQL at deploy time.
- Created this `CLAUDE.md` (project guide + action log).
- **Phase 2 — data model & CRUD** built:
  - `app/db.py` — lazy engine (`get_engine`, `lru_cache`) so importing never requires the Postgres driver; `SessionLocal`, `get_db`, `init_db`.
  - `app/models.py` — ORM models: `System`, `Priority` (unique per system+year+month), `Task`, `Subtask`, `FocusBlock`, `AgentProgram`, `AgentAssignment`; `StrEnum`s `SystemStatus`/`WorkStatus`; `TimestampMixin`; cascade deletes.
  - `app/schemas.py` — Pydantic Create/Update/Read for all entities; `SystemRead.current_priority` and `SubtaskRead.inherited_priority` computed fields.
  - `app/services.py` — `get_current_priority`, `get_inherited_priority`, and `emit_event` (change-event hook stub that Part B's AI brain will subscribe to).
  - `app/api/` — routers: `systems` (+ nested priorities, `PUT` upsert per month), `tasks` (+ subtasks), `calendar` (focus blocks), `agents` (programs + assignments). Wired into `main.py`.
  - Alembic scaffolding: `alembic.ini`, `alembic/env.py` (wired to Base + settings URL), `script.py.mako`, `versions/`. `scripts/init_db.py` for dev table creation.
  - `docs/DATABASE.md` — local Postgres (Docker/native) + future Cloud SQL setup.
  - Tests: `tests/test_crud.py` (in-memory SQLite, no live DB needed) covering priority inheritance, cascade delete, monthly priority upsert idempotency, focus blocks & agent assignment.
  - **Verified locally:** `ruff check` clean; `pytest` 6 passed. (Local venv built on disk at `%LOCALAPPDATA%\Temp\mindanchor-venv`; latest dep versions used for the 3.14 interpreter — CI/deploy use the pinned versions on Python 3.11.)
  - Fixes during build: lazy engine (avoid eager `psycopg2` import); `StrEnum` (UP042); ruff ignore `B008` (FastAPI `Depends` idiom); resolved `app` package vs FastAPI-instance name collision in tests.
- Added the **"Resume here"** section at the top of this file (status, next step, run/test commands, environment gotchas) so a fresh session can pick up cleanly.
