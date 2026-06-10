# CLAUDE.md — MindAnchor project guide & action log

This file is the working memory for the MindAnchor build. It records **what the project is**, **the decisions made**, and a **chronological log of every action taken**. Update the action log on every meaningful change.

---

## ▶ Resume here (read this first)

**Status:** Phases 1–7 are **done, committed, pushed** to `origin/main`. Working tree clean (except local gitignored `backend/.env`, which now holds the user's rotated key). Reports + morning briefing + client-side notifications all work.

**Do next:** **Phase 8 — PWA polish + RN scaffold** (offline shell, real PWA icons, mobile-viewport pass, scaffold `mobile/` Expo). OR jump to **Deploy** (Cloud SQL + Cloud Run + Vercel) — then Tier-2 server push (`docs/NOTIFICATIONS.md`). Ask the user which.

**Live agent is ON:** `backend/.env` has a real (rotated) key, so `get_llm()`/`get_intake()` use real Claude when the backend runs. Not yet smoke-tested live (needs backend running against local Postgres). Tests stay offline via `tests/conftest.py`.

**To enable the real Claude agent:** key already in local `backend/.env` (gitignored). `get_llm()` auto-switches StubLLM→AnthropicLLM. See `docs/AGENTS.md`.

**⚠ Security note (2026-06-10):** an API key was briefly pasted into the *tracked* `backend/.env.example`. It was reverted before any commit (never entered git history) and moved to the gitignored `backend/.env`. Because it was exposed in the session transcript, **rotate that key** at console.anthropic.com when convenient and update `backend/.env`. Only `backend/.env` (gitignored) should ever hold a real key.

**How to run & test (Windows, network-share repo):**
- Backend API: `cd backend` → `uvicorn app.main:app --reload --port 8000` (needs deps installed + `.env`).
- Frontend: `cd frontend` → `npm install` → `npm run dev` (http://localhost:5173, proxies `/api` → `:8000`).
- Backend tests use **in-memory SQLite — no live DB needed**.

**⚠ Environment gotchas (learned the hard way — don't repeat):**
- **Do NOT build the Python venv on the network share** and do not run `pip install --upgrade pip` there — it corrupts pip mid-write (`pip._vendor.rich` ModuleNotFoundError). Build the venv on **local disk**.
- The working test venv is at `%LOCALAPPDATA%\Temp\mindanchor-venv` (Python 3.14). It may be gone tomorrow (temp dir) — if so, recreate on local disk.
- Local Python is **3.14**, which has **no wheels** for the pinned dep versions (pydantic-core fails to build). For local testing, `pip install -U fastapi pydantic pydantic-settings sqlalchemy httpx pytest ruff` (latest, has cp314 wheels). **CI and deploy use the pinned `requirements.txt` on Python 3.11** — keep the pins as-is.
- Run lint+tests: `cd backend` then `<localvenv>\Scripts\python.exe -m ruff check .` and `... -m pytest -q`. Last run: ruff clean, 6 passed.
- For DB work locally: start Postgres (Docker one-liner in `docs/DATABASE.md`), set `backend/.env` `DATABASE_URL`, then `python scripts/init_db.py`.
- **Frontend build cannot run from the network share:** `npm run <script>` spawns `cmd.exe` which rejects UNC cwd, and `esbuild`'s postinstall fails under UNC (rolls back `node_modules`). To verify the frontend, **copy `frontend/` to a local-disk temp dir** (e.g. `%LOCALAPPDATA%\Temp\mindanchor-fe`), then `npm install` and build by calling node directly: `node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build`. CI (GitHub Actions, ubuntu) builds it normally — no UNC issue there. Last local build: ✅ tsc clean, vite built, PWA SW generated.

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
- **Phase 3 — dashboard, calendar & rule-based daily focus** built:
  - Backend:
    - `models.py` — added `CheckIn` (day, notes, `completed_task_ids` JSON).
    - `services.py` — rule-based daily focus: `choose_focus_system` (active system with open work + highest current-month priority, ties by nearest deadline) and `build_today` (focus system + tasks, upcoming deadlines within 7 days, flagged = overdue or blocked). Deterministic, no AI.
    - `schemas.py` — `CheckInCreate/Read`, `TodayView`.
    - `api/dashboard.py` — `GET /dashboard/today`; `api/checkins.py` — `GET/POST /check-ins` (marks reported tasks done). Wired into `main.py`.
    - Tests: `tests/test_dashboard.py` — focus selection, upcoming/flagged buckets, check-in marks done + history, empty dashboard. **Verified: ruff clean, 10 passed.**
  - Frontend (React PWA):
    - `src/types.ts`, `src/api.ts` (typed fetch client over `/api`).
    - Router in `src/main.tsx`; nav layout in `src/App.tsx` (Today / Systems / Calendar).
    - `src/components/ui.tsx` (Card, StatusBadge, Empty).
    - Pages: `Dashboard` (today's focus, upcoming, flagged, end-of-day check-in), `Systems` (CRUD systems, set monthly priority, manage tasks + subtasks with inherited priority shown), `Calendar` (focus-block agenda + add/delete).
    - Fixed a tsc pitfall: `useEffect(load, [])` → wrapped (effects must return void).
- **Phase 4 — orchestrator + event-triggered specialist agents** (the AI brain, backend) built:
  - `models.py` — `RebalanceProposal` (system_id, trigger, summary, `actions` JSON, `ProposalStatus` pending/approved/rejected, decided_at).
  - `schemas.py` — `ReorderAction` / `AddPretaskAction` (allow-listed `ProposalAction` union), `RebalanceProposalRead`.
  - `agents/llm.py` — `LLMClient` protocol; `StubLLM` (deterministic, offline: orders open tasks by deadline, suggests prep pre-task for ≤3-day deadlines); `AnthropicLLM` (lazy `anthropic` import, strict-JSON prompt); `get_llm()` auto-selects by key presence.
  - `agents/orchestrator.py` — `build_context`, `propose_for_system` (validates agent actions, drops malformed, stores pending), `apply_proposal` (reorder / add_pretask, only own-system tasks), `decide_proposal`.
  - `api/rebalance.py` — `POST /systems/{id}/rebalance`, `GET /rebalance-proposals`, `GET /rebalance-proposals/{id}`, approve/reject. Wired into `main.py`.
  - `docs/AGENTS.md` — agent design, action allow-list, API, how to enable real Claude.
  - Tests: `tests/test_rebalance.py` — stub selection w/o key, propose→approve reorders by deadline, reject doesn't apply, can't decide twice, add_pretask creates front task. **Verified: ruff clean, 15 passed (no key/network needed).**
  - Human-gated by design: agents only ever propose; nothing applies until approve.
- **Phase 5 — propose→approve UI** built:
  - `frontend/src/types.ts` + `api.ts` — `RebalanceProposal`/`ProposalAction` types; `requestRebalance`, `listProposals`, `approveProposal`, `rejectProposal`.
  - `frontend/src/pages/Proposals.tsx` — lists pending proposals, renders actions as a readable diff (resolves task titles), approve/reject.
  - `Systems.tsx` — per-System **Rebalance** button + success notice; nav link + route added.
  - **Verified:** local-disk `tsc` clean + `vite build` (37 modules). Backend propose→approve already covered by 15 tests.
  - Handled the key-in-`.env.example` incident (see Security note above): reverted tracked file, created gitignored `backend/.env`, confirmed key absent from git history.
- **Phase 6 — AI intake interview** built:
  - `agents/intake.py` — `StubIntake` (fixed 6-question sequence: name/purpose/goals/constraints/dependencies/delivery → deterministic starter task tree) + `AnthropicIntake` (Claude, one-question-at-a-time, strict-JSON); `get_intake()` auto-selects by key.
  - `schemas.py` — `IntakeStepRequest`, `IntakeStep`, `IntakeProposal`/`ProposedTask`/`ProposedSubtask`, `IntakeCommit`.
  - `api/intake.py` — `POST /intake/next` (next question or final proposal), `POST /intake/commit` (persist System+Tasks+Subtasks after approval). Wired into `main.py`.
  - `tests/conftest.py` — **autouse fixture forces empty ANTHROPIC_API_KEY** so tests never use the dev `.env`/real API. (Fixed intake/rebalance tests that broke once `backend/.env` existed.)
  - Tests: `tests/test_intake.py` — one-question-at-a-time, first Q is name, commit persists tree. **Verified: ruff clean, 18 passed.**
  - Frontend: `pages/Intake.tsx` (conversational interview → review proposed system+tasks → "Create system"), `types.ts`/`api.ts` intake additions, nav "New system" + route. **Verified: vite build clean.**
- **Phase 7 — reports & notifications** built:
  - `app/reports.py` — deterministic generators: `weekly_report`, `monthly_report`, `on_demand_report`, `morning_briefing` (per-system stats, overdue/upcoming, completion %). `schemas.Report`/`ReportSection`.
  - `api/reports.py` — `GET /reports/{weekly,monthly,on-demand,morning-briefing}`. Wired into `main.py`.
  - Tests: `tests/test_reports.py` — structure + content (behind/coming, completion %, overdue, briefing focus, empty-DB safety). **Verified: ruff clean, 23 passed.**
  - Frontend: `pages/Reports.tsx` (weekly/monthly/on-demand tabs + briefing section with Enable-notifications and Show-briefing-now via the SW). Nav "Reports" + route. **Verified: vite build clean.**
  - `docs/NOTIFICATIONS.md` — Tier 1 (client notifications, done) vs Tier 2 (VAPID + pywebpush + scheduler, deploy-time).
  - User rotated the exposed API key; new key in gitignored `backend/.env`.
