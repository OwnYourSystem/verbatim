# MindAnchor

> Your external brain. AI project manager + scrum master + calendar + morning briefing — for one person managing a high-volume, complex workload alone.

MindAnchor is a personal, AI-powered productivity system. You set monthly priorities once; MindAnchor keeps you oriented every day — what to do, why, and what's next.

## Status

🚧 **In active development.** Built in phases (skeleton-first, then the AI brain).

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
| Hosting | Vercel (frontend) + Cloud Run / Railway (backend) |
| Mobile (later) | React Native (Expo), shared logic |

## Monorepo layout

```
MindAnchor/
├── frontend/   # React PWA
├── backend/    # FastAPI + agent orchestration
├── mobile/     # React Native (later phase)
└── docs/       # architecture, decisions
```

## Development phases

**Part A — usable skeleton (no AI)**
1. Scaffold & repo ✅
2. Data model & CRUD
3. Dashboard, calendar & rule-based daily focus

**Part B — the AI brain**
4. Orchestrator + event-triggered specialist agents
5. Dynamic rebalancing (propose → approve)
6. AI intake interview
7. Reports & push notifications

**Part C — mobile**
8. PWA polish + React Native scaffold

## Local development

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md).

## License

Private / personal use.
