# MindAnchor

> Your external brain. AI project manager + scrum master + calendar + morning briefing — for one person managing a high-volume, complex workload alone.

MindAnchor is a personal, AI-powered productivity system. You set monthly priorities once; MindAnchor keeps you oriented every day — what to do, why, and what's next.

## Status

🟢 **Live on Google Cloud.** Phases 1–7 done (full manual app + the AI brain + reports/briefing) and **deployed to Cloud Run + Cloud SQL** with auto-deploy from `main`. Remaining: PWA polish + native mobile scaffold (Phase 8).

| Surface | URL |
|---|---|
| **Web app** | https://mindanchor-frontend-2814170686.europe-north2.run.app |
| Backend API / docs | https://mindanchor-p56twm4tsa-ma.a.run.app · `/docs` |

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for the deployment runbook and architecture diagram.

The AI agents run against real Claude when an `ANTHROPIC_API_KEY` is present, and fall back to deterministic **offline stubs** otherwise — so the whole app (and the full test suite) works with no key or network.

## Concept

Work is organized in three levels:

- **Systems** — top-level domains (e.g. *SAP Datasphere CLI*, *Alchemy*, *Vanguard*)
- **Tasks** — discrete pieces of work inside a System
- **Subtasks** — granular steps inside a Task

Subtasks inherit their parent System's priority. Priority is set monthly and drives everything: scheduling, daily focus, weekly plans, reports.

A set of **event-triggered specialist AI agents** (one per System or cluster) acts as the brain. When you add/remove a task or change a priority, the responsible agent recomputes preceding and pending work and **proposes** a new plan — nothing changes until you approve.

## Architecture (high level)

```
You set priorities + tasks  (immutable foundation)
        │
        ▼
  Orchestrator Agent ──assigns──► Specialist Agents (1 per System/cluster)
        │                              │
   reads full state              each has an editable role file (program.md)
   fires on events               proposes task/schedule diffs → you approve
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for detail.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui (PWA, installable on mobile) |
| Backend | FastAPI (Python) + SQLAlchemy + Alembic |
| Database | Google Cloud SQL (PostgreSQL) |
| AI | Anthropic Claude API (Opus for planning, Sonnet for fast calls) |
| Auth | Single-user JWT |
| Push | Web Push API (PWA service worker) |
| Hosting | Google Cloud Run — frontend (nginx) + backend (FastAPI); Cloud Build auto-deploy |
| Mobile (later) | React Native (Expo), shared logic |

## Monorepo layout

```
MindAnchor/
├── frontend/   # React PWA
├── backend/    # FastAPI + agent orchestration
├── mobile/     # React Native (later phase)
└── docs/       # architecture, decisions
```

## Features

- **Systems → Tasks → Subtasks** with monthly priorities; subtasks inherit their System's priority.
- **Dashboard** — rule-based daily focus (highest-priority active system with open work), upcoming deadlines, flagged (overdue/blocked) items.
- **End-of-day check-in** — closes the loop and marks tasks done.
- **Calendar** — focus-block agenda.
- **AI intake interview** — one question at a time → proposes a System + task tree you approve before saving.
- **Propose → approve rebalancing** — per-System specialist agents propose reorders / pre-tasks; nothing applies until you approve.
- **Reports** — weekly, monthly, on-demand, plus a morning briefing; client-side notifications.

## API overview

| Area | Endpoints |
|---|---|
| Systems & priorities | `GET/POST /systems`, `GET/PATCH/DELETE /systems/{id}`, `GET/PUT /systems/{id}/priorities` |
| Tasks & subtasks | `GET/POST /tasks`, `GET/PATCH/DELETE /tasks/{id}`, `GET/POST /subtasks`, `PATCH/DELETE /subtasks/{id}` |
| Calendar | `GET/POST /focus-blocks`, `PATCH/DELETE /focus-blocks/{id}` |
| Agents | `GET/POST/PATCH/DELETE /agent-programs`, `GET/PUT/PATCH/DELETE /agent-assignments` |
| Dashboard & check-ins | `GET /dashboard/today`, `GET/POST /check-ins` |
| Rebalancing (AI) | `POST /systems/{id}/rebalance`, `GET /rebalance-proposals`, `.../{id}/approve`, `.../{id}/reject` |
| Intake (AI) | `POST /intake/next`, `POST /intake/commit` |
| Reports | `GET /reports/{weekly,monthly,on-demand,morning-briefing}` |

Interactive docs at `/docs` when the backend runs.

## Development phases

**Part A — usable skeleton (no AI)**
1. Scaffold & repo ✅
2. Data model & CRUD ✅
3. Dashboard, calendar & rule-based daily focus ✅

**Part B — the AI brain**
4. Orchestrator + event-triggered specialist agents ✅
5. Dynamic rebalancing (propose → approve) ✅
6. AI intake interview ✅
7. Reports & morning briefing ✅

**Part C — mobile & deploy**
8. PWA polish + React Native scaffold — _pending_
9. Cloud deployment (Cloud SQL + Cloud Run, auto-deploy via Cloud Build) — ✅ **live**

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — project guide, locked decisions, "Resume here", and full action log.
- [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md) — architecture & philosophy (with the diagram).
- [`docs/DEPLOY.md`](docs/DEPLOY.md) — **live deployment runbook** (Cloud Run + Cloud SQL + Cloud Build).
- [`docs/DATABASE.md`](docs/DATABASE.md) — local Postgres now, Cloud SQL in production.
- [`docs/AGENTS.md`](docs/AGENTS.md) — the AI brain: agents, action allow-list, enabling real Claude.
- [`docs/NOTIFICATIONS.md`](docs/NOTIFICATIONS.md) — morning briefing & push (Tier 1 done, Tier 2 at deploy).

## Local development

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md).

### Quick start

```bash
# Backend (needs local Postgres + backend/.env — see docs/DATABASE.md)
cd backend && python -m venv .venv && .venv/Scripts/Activate.ps1
pip install -r requirements.txt
python scripts/init_db.py
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
```

> On a Windows network-share checkout, build the venv / run npm from a local-disk copy — see the environment notes in [`CLAUDE.md`](CLAUDE.md).

## License

Private / personal use.
