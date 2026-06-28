# CLAUDE.md — MindAnchor project guide & action log

This file is the working memory for the MindAnchor build. It records **what the project is**, **the decisions made**, and a **chronological log of every action taken**. Update the action log on every meaningful change.

---

## ▶ Resume here (read this first)

**Status:** Phases 1–9 are **done, committed, pushed**. Production is **live on Google Cloud** (project `mindanchor-500313`, region `europe-north2`) — Cloud Run + Cloud SQL. The authoritative runbook is `docs/DEPLOY.md`; architecture in `docs/DOCUMENTATION.md`.

**⚠ Actual production topology (authoritative — 2026-06-28, from owner's deploy docs):**
- **Frontend:** Cloud Run `mindanchor-frontend` (`https://mindanchor-frontend-2814170686.europe-north2.run.app`) — React/Vite SPA served by nginx; nginx proxies `/api/*` to the backend server-side (so no CORS hop). **Deployed manually** (no Cloud Build trigger yet).
- **Backend:** Cloud Run `mindanchor` (`https://mindanchor-p56twm4tsa-ma.a.run.app`), FastAPI/uvicorn, Docker from `backend/`. Auto-deployed from GitHub `main` by a **Cloud Build trigger** (build `backend/Dockerfile` → Artifact Registry → `gcloud run services update`). The deploy step **only swaps the image**, so Cloud Run env vars persist.
- **Database:** Cloud SQL Postgres `mindanchor-db`, reached via the Cloud SQL connector socket. `config.py` still normalizes a bare `postgres://` `DATABASE_URL` to `postgresql+psycopg2://` (SQLAlchemy 2.x rejects the alias).
- **Migrations:** applied on startup by the FastAPI lifespan hook in `app/main.py` (`alembic upgrade head`).
- **⚠ Stale-but-tracked config:** `render.yaml` and `frontend/vercel.json` are from the earlier Render/Vercel plan and are **NOT used** by the live GCP deploy. The GCP setup lives in `deploy/cloudrun.yaml` + `deploy/cloudsql-setup.sh`. `docs/DEPLOY.md` references `frontend/nginx.conf` / frontend `Dockerfile` / root `docker-compose.yml` that are **not yet committed** to the repo.

**⚠ Frontend changes don't auto-deploy:** the Cloud Build trigger rebuilds the **backend only**. Merging to `main` will NOT update the live frontend — run the manual frontend deploy in `docs/DEPLOY.md`. For breaking API changes (e.g. CR-2's SK `rating`), deploy **backend first, then frontend**.

**Do next:** CR-2 (SK rating model) is on branch `claude/determined-curie-h90f00` → open/merge PR so the backend auto-deploys + runs migration 0009, then **manually deploy the frontend** for the new SK Universe/Knowledge Pool to appear live. Optionally wire a frontend Cloud Build trigger. Then Tier-2 server push notifications (`docs/NOTIFICATIONS.md`).

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

## Operating model (set by owner 2026-06-28)

How this project is worked on going forward:

- **GitHub is the single source of truth.** All changes land via branches → PRs → merge to `main`. This Claude Code session/env is **ephemeral**: nothing is persisted on it except (a) code, which must be pushed to the repo, and (b) learnings, which must be committed here in `CLAUDE.md`. Treat the local checkout as disposable.
- **Infra is GCP** for both test and prod (Cloud Run + Cloud SQL). Deploys are **GitHub-driven**: merge to `main` → Cloud Build trigger auto-deploys (backend today; frontend once its trigger is created). No credentials should live on the ephemeral env — the CI/CD is keyless/GitHub-triggered by design.
- **The repo is multi-user.** Other people clone it and deploy to *their own* GCP projects. Keep everything generic: no machine-specific absolute paths, no secrets, working `SETUP.md`. (The Windows/network-share notes below are the *owner's personal* local-dev quirks, not requirements for others.)
- **Owner needs deployment visibility from inside the Claude env** to make test/feedback decisions. ⚠ **Current limitation (2026-06-28):** this env has **no `gcloud`, no GCP MCP connector, and its network policy blocks egress to `*.run.app`** (agent proxy returns `403 CONNECT` for the Cloud Run hosts — verified via `$HTTPS_PROXY/__agentproxy/status`). So from here I can read **GitHub** (PRs, CI/commit statuses, Cloud Build statuses posted to GitHub) but **cannot reach the live app or GCP directly**. To enable runtime visibility the owner must, at env-creation time: allow egress to the Cloud Run hosts in the network policy, and/or add a read-only GCP credential or a GCP MCP connector. Until then, report deploy results via GitHub statuses, not by curling the app.

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

### 2026-06-28 — Deploy-doc reconciliation, frontend deploy infra, multi-user repo + operating model

Follow-ups after CR-2 (all on branch `claude/determined-curie-h90f00`, PR #10):

- **Deploy docs reconciled to GCP.** The repo's docs contradicted each other and reality (`docs/DEPLOY.md`→Railway, `docs/DOCUMENTATION.md`→Render, `CLAUDE.md`→Render+Vercel). Rewrote `docs/DEPLOY.md` (GCP runbook), `docs/DOCUMENTATION.md` (Cloud Run/Cloud SQL topology, migrations 0001→0009), and the `CLAUDE.md` "Resume here" block. Flagged `render.yaml` / `frontend/vercel.json` as stale-but-tracked.
- **Frontend deploy infra committed** (the live frontend had been deployed from uncommitted infra with no trigger): `frontend/Dockerfile` (node build → nginx on `$PORT`), `frontend/nginx.conf` (envsubst template; proxies `/api/` → `${BACKEND_ORIGIN}` with the prefix stripped to match FastAPI's root-mounted routes; SPA fallback; SW/asset cache headers), `frontend/.dockerignore`, `frontend/cloudbuild.yaml` + the `gcloud builds triggers create` command, root `docker-compose.yml`. ⚠ Image not built here (no docker daemon); `npm run build` passes, nginx template is standard — validate via Cloud Build or `docker compose up --build`.
- **Repo generalized for multi-user sharing:** new `SETUP.md` (clone → run locally via Docker or manually → self-host on your own GCP), README refreshed (status = live on GCP; hosting = Cloud Run + Cloud SQL; cross-platform Docker quick start; doc index). Secret check: only `backend/.env.example` + `sk-ant-...` placeholders tracked; real `.env` gitignored.
- **Operating model recorded** (see the new section above): GitHub = single source of truth, ephemeral env, GCP GitHub-driven deploys, multi-user repo, and the current GCP-visibility limitation (no gcloud/GCP MCP, egress to `*.run.app` blocked by the env network policy).
- **PR #10 opened** (`claude/determined-curie-h90f00` → `main`) and **subscribed** for CI/review autofix. CI note: GitHub Actions `ci.yml` doesn't run on this PR (effectively runs on `main` pushes; `main`'s recent runs fail on deploy jobs that need secrets — pre-existing, not code). Verified locally instead: ruff 0.8.4 clean, 40 tests pass, frontend build OK.
- **Vercel retired (repo side)** at owner's request: removed the `deploy-frontend (Vercel)` job + the dist-artifact upload step from `ci.yml` (this Vercel job was what made `main`'s CI red — it ran `vercel deploy` with no token), deleted `frontend/vercel.json`, and fixed a stale Vercel CORS example in `config.py`. ⚠ The **Render** deploy job + `render.yaml` were left in place (not requested; the Render CI job is a graceful no-op). ⚠ **Account side is manual — the Vercel MCP connector is read-only (no disconnect/delete tool).** To stop the preview builds + PR comments, the owner must disconnect the repo from the Vercel project `mind-anchor` (`prj_h3t0CSsFtktaN10nSsy5hxmtt3jO`, team `oys-s-projects`) in the Vercel dashboard (Settings → Git → Disconnect), or remove the Vercel GitHub app.

### 2026-06-28 — Change Request 2 (CR-2): coherent SK ER model, 3-level thermometer, 3D universe

Reworked Specific Knowledge (SK), Knowledge Pool, and SK Universe into a coherent, normalized model. Three product decisions were confirmed with the owner first: (1) replace the 1–10 temperature with **3 discrete levels HOT/WARM/COLD**; (2) **AI suggests the rating at setup, finalizes it on completion, user can override**; (3) **normalize the SK↔work-item link into join tables** (real ER, not a JSON id-list).

- **Data model (`models.py`):** new `SKRating` enum (cold/warm/hot). `SpecificKnowledge.temperature` → `rating` (+ `rating_finalized` flag); SKs stay unique by `name`. New association tables `task_specific_knowledge` and `subtask_specific_knowledge` (many-to-many, `ON DELETE CASCADE`) with `Task.specific_knowledges` / `Subtask.specific_knowledges` relationships. Dropped the denormalized `sk_ids` JSON column from `WorkItemMixin`.
- **Migration `0009_sk_ratings_and_join_tables.py`:** creates the two join tables, adds `rating`/`rating_finalized`, backfills ratings from old temperatures (≥7 hot, ≥4 warm, else cold) and join rows from the old `sk_ids` (Postgres `json_array_elements_text`), then drops `temperature` + `sk_ids`. Verified the full 0001→0009 chain runs clean on SQLite.
- **Rating lifecycle:** `services.finalize_sks_for_item()` re-runs the AI rater (HOT/WARM/COLD on uniqueness / not-teachable-elsewhere) and locks each attached SK when its Task/Subtask is marked **done** — wired into tasks PATCH/POST and the check-in flow. Manual rating edits via `PUT /specific-knowledges/{id}` set `rating_finalized=True` (override wins). SK enters Knowledge Pool + SK Universe on completion (unchanged semantics, now computed via the relationships).
- **AI (`agents/llm.py`):** `suggest_sk()` now returns `{name, rating, justification}` with rating coerced to hot/warm/cold (tolerates legacy numeric input); stub + Anthropic prompts updated to the 3-level rubric.
- **API/schemas:** SK schemas use `rating`; Task/Subtask **reads** expose nested `specific_knowledges`, **writes** accept `sk_ids` (resolved to the relationship). SK list now sorts HOT→WARM→COLD.
- **Frontend:** shared `components/Thermometer.tsx` (3-zone clickable thermometer + `RatingBadge` + helpers). **Knowledge Pool** rebuilt on the 3 levels with a "suggested" hint until finalized. **SK Universe**: removed the **"YOU"** label, mapped rating → 3 orbit tiers, and made it fully move-around 3D (drag horizontally = orbit/spin, vertically = tilt, scroll = zoom). **WorkItemEditor** gained a Specific-Knowledge section to define/attach SKs while setting up a task/subtask, with an **✨ AI suggest** button.
- **Tests:** updated `test_new_features` SK tests to the rating model + added a test that an SK attaches to a task and enters the Universe (with finalized rating) on completion. **Verified: ruff (CI-pinned 0.8.4) clean, 40 backend tests pass; frontend tsc clean + vite build OK; migration chain applies on SQLite.**

### 2026-06-12 — Change Request 1 (CR-1): rich task attributes, time tracking, scrum-master AI, charts

Implemented the first testing-phase change request end-to-end:

- **Data model (`models.py`):** new `WorkItemMixin` shared by Task & Subtask — `description`, `status`, `priority` (1=highest…5=lowest), `deadline`, `dedicated_hours`, `data_exposure_concern`, `last_checkpoint` (Planning/Development/Testing/Staging/Production), `required_demo`, `position`. New `TimeLog` table (hours spent against a task/subtask). Migration `0002_task_attributes_and_time_logs.py`.
- **Hours budgeting (§4):** `services.computed_fields()` derives `spent_hours` (sum of TimeLogs), `remaining_hours` (dedicated − spent), `time_left_days` (deadline − today). On every Task/Subtask read and in reports.
- **API:** Task/Subtask reads carry computed fields; all attributes editable via PATCH. New time-log endpoints (`GET/POST/DELETE /time-logs`). Calendar reads include `task_title`/`system_name`.
- **AI scrum master (§5, §7):** `StubLLM` rewritten as a deterministic agile scrum master (re-sequence by priority+deadline, size unestimated work, escalate near deadlines, flag overdue/over-budget/data-exposure/demo risks, schedule urgent work, prep pre-task). Expanded action set: `update_task`, `add_task`, `add_subtask`, `schedule` (→ calendar), `insight` (PM notes) plus `reorder`/`add_pretask`. `AnthropicLLM`/`AnthropicIntake` prompts upgraded to a veteran-scrum-master persona that fills **all** attributes. Intake commit persists every attribute and seeds the calendar for dated tasks (§9).
- **Reports (§6):** structured `charts` (bar / pie / waterfall) on weekly/monthly/on-demand — completion %, status mix, hours budget-vs-spent-vs-remaining. Pure-SVG chart components (`components/Charts.tsx`), no new npm deps (keeps `npm ci` lockfile-safe).
- **Frontend:** `components/WorkItemEditor.tsx` — full editable attribute form + inline time logging + hours bar + priority badge, reused for Tasks and Subtasks. `Systems.tsx` rebuilt around it; `Calendar.tsx` shows/schedules tasks; `Reports.tsx` renders charts; `Proposals.tsx` renders new actions + insights; `Intake.tsx` shows AI-filled attributes.
- **Priority hierarchy (§10):** task/subtask `priority` is 1=highest … 5=lowest throughout (colour-coded badges; AI escalates to P1 near deadlines).
- **Tests:** added `tests/test_attributes.py`. **Verified: ruff clean, 30 backend tests pass; frontend tsc clean + vite build OK.**

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
- **Phase 9 — Deploy** built and pushed (branch `claude/vibrant-gates-n8qbnf`):
  - `backend/Dockerfile` — multi-stage (builder + runtime), non-root user, psycopg2-binary, PORT env var for Cloud Run.
  - `backend/.dockerignore` — excludes `.env`, tests, caches, `__pycache__`.
  - `backend/app/core/config.py` — `debug=False` default; CORS from env; Cloud SQL socket path documented.
  - `backend/alembic/versions/0001_initial_schema.py` — initial migration for all 9 tables + indexes; ruff-clean.
  - `frontend/vercel.json` — `/api/*` rewrite proxy to Cloud Run URL; SW `Cache-Control` headers; immutable asset cache.
  - `.github/workflows/ci.yml` — extended to 5 jobs: backend lint+test → frontend build → Docker build+push (Artifact Registry) → Cloud Run deploy + `alembic upgrade head` as Cloud Run Job → Vercel deploy (pre-built dist); Workload Identity Federation (keyless auth).
  - `deploy/cloudrun.yaml` — Cloud Run service manifest (scale-to-zero, 512 MB, Cloud SQL sidecar, Secret Manager refs).
  - `deploy/cloudsql-setup.sh` — one-shot infra script: enable APIs, create Cloud SQL, DB + user, Secret Manager secrets, Artifact Registry, service account + IAM.
  - `docs/DEPLOY.md` — full deployment guide: architecture diagram, step-by-step setup, Workload Identity Federation, cost table (~$8–10/mo), env var reference.
  - **Verified:** `ruff check` clean; 23 pytest tests pass.
- **Phase 8 — PWA polish + RN scaffold** built and pushed (branch `claude/vibrant-gates-n8qbnf`):
  - **PWA icons:** `icon.svg` anchor design → rasterised to `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180), `favicon.png` (32×32) via cairosvg.
  - **vite.config.ts:** added `maskable` icon purpose, `orientation`, `categories`; full Workbox config: precache all assets, navigation fallback → `index.html`, runtime StaleWhileRevalidate cache for `/api/*` (5 min / 50 entries).
  - **index.html:** full PWA meta tags — `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `viewport-fit=cover`, apple-touch-icon link.
  - **public/offline.html:** offline fallback page (anchor emoji + "Try again" button, pure CSS, no deps).
  - **App.tsx:** sticky header (`top-0 z-10`), nav strip `overflow-x-auto scrollbar-none` for mobile, `whitespace-nowrap` on links, `flex flex-col` wrapper, `pb-[env(safe-area-inset-bottom)]` for iOS safe area.
  - **tailwind.config.js:** `scrollbar-none` plugin (hides scrollbar cross-browser).
  - **mobile/** Expo scaffold: `app.json`, `package.json`, `babel.config.js`, `tsconfig.json`; Expo Router tab layout; 4 screens (TodayScreen, SystemsScreen, ProposalsScreen, ReportsScreen); shared `src/api/index.ts`, `src/types.ts`, `src/components/ui.tsx` (RN primitives), `src/hooks/useAsync.ts`; `mobile/README.md` with setup + run instructions.
  - **Frontend build verified:** tsc clean, vite build ✅, PWA SW precaches 17 entries (269 KB).
- **Docs refresh:** updated root `README.md` to current state — status (Phases 1–7 done), Features list, API overview table, phase checkmarks (1–7 ✅; 8 + deploy pending), a Documentation index, and a Quick start. README previously still showed only Phase 1 done.
