# MindAnchor — Architecture

This document records the design and the key decisions behind it. It is the source of truth for *why* the system is shaped the way it is.

---

## 1. Design principles

1. **Human-gated.** The AI never reorganizes your work without approval. It *proposes*; you *accept*. This is a hard product constraint.
2. **Constraint-based agent autonomy** (inspired by [autoresearch](https://github.com/OwnYourSystem/autoresearch)). Each agent has:
   - a **fixed scope** — one System or a small cluster,
   - an editable **role instruction file** (`program.md`-style, stored in DB),
   - a **read-only foundation** it cannot override — your monthly priorities and deadlines,
   - a **metric** it optimizes — on-time delivery %, priority alignment.
3. **Event-triggered, not continuous.** Unlike autoresearch's infinite loop, MindAnchor agents fire only on events (task edit, priority change, check-in, weekly cycle). This keeps cost bounded and behavior predictable for a single-user tool.
4. **Skeleton-first.** The app is fully usable manually before any AI is added. The AI is a layer on top of a working tool, never a prerequisite for using it.

---

## 2. Data model

Three-level hierarchy plus supporting entities.

```
System (priority, set monthly)
  └── Task (deadline, status)
        └── Subtask (inherits System priority)

Priority        — monthly priority score per System
FocusBlock      — scheduled work window on the calendar
AgentAssignment — which agent owns which System/cluster
AgentProgram    — the editable role instruction file for an agent
RebalanceProposal — a proposed diff awaiting user approval
CheckIn         — end-of-day completion record
```

**Priority inheritance.** A Subtask's effective priority = its parent System's current monthly priority. Changing a System's priority cascades to all its Tasks and Subtasks for scheduling purposes.

---

## 3. The agent layer (Part B)

```
                 ┌─────────────────────────────┐
   user event ──►│      Orchestrator Agent      │
 (edit/priority/ │  - reads full workspace      │
  check-in)      │  - routes event to the right │
                 │    specialist                │
                 └──────────────┬───────────────┘
                                │ delegates
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                 ▼
        ┌───────────┐    ┌───────────┐    ┌───────────┐
        │ Agent A    │    │ Agent B    │    │ Agent N    │
        │ System: SAP│    │ System:    │    │ System:    │
        │ Datasphere │    │ Alchemy    │    │ ...        │
        └─────┬──────┘    └─────┬──────┘    └─────┬──────┘
              │ proposes diff    │                 │
              ▼                  ▼                 ▼
        ┌──────────────────────────────────────────────┐
        │   RebalanceProposal  (awaiting your approval)  │
        └──────────────────────────────────────────────┘
```

- **Orchestrator** holds the global picture, assigns agents, and routes events. Uses the stronger model (Opus) for planning.
- **Specialist agents** reason only within their assigned System. They recompute preceding/pending tasks when something changes, then emit a proposed diff. Use the faster model (Sonnet) where possible.
- **Rebalance guardrails:** events are debounced; a single editing burst yields one proposal, not many. A cost ceiling caps API spend per rebalance cycle.

---

## 4. Request/event flow (rebalancing)

```
1. User changes a System priority (or adds/removes a task)
2. Backend writes the change, emits a domain event
3. Debounce window collects rapid successive edits
4. Orchestrator routes to the affected specialist agent(s)
5. Agent reads current state + its program.md + immutable priorities
6. Agent returns a proposed plan (reordered tasks, new pre-tasks, schedule shifts)
7. Backend stores it as a RebalanceProposal (status = pending)
8. UI shows the diff; user approves or rejects
9. On approve → changes applied, calendar + dashboard update
```

---

## 5. Tech decisions (ADR-style summary)

| Decision | Choice | Why |
|---|---|---|
| Database | Google Cloud SQL (PostgreSQL) | Relational fit for the hierarchy; user is learning GCP |
| Backend | FastAPI | Async, clean streaming for Claude, easy agent orchestration |
| Frontend | React + Vite + Tailwind, PWA | One codebase, installable on mobile without a native app yet |
| Agent execution | Event-triggered Claude calls behind an orchestrator | Cheaper & simpler than continuous loops; human-gated by design |
| Auth | Single-user JWT | Product is explicitly single-user; no multi-tenant complexity |
| Rebalance policy | Propose → approve | Matches the "never auto-reorganize" product rule |

---

## 6. Out of scope (v1)

- Team features, sharing, delegation, collaboration — MindAnchor is single-user by design.
- Native mobile app — a PWA ships first; React Native follows in a later phase.
- Continuous autonomous agent loops — deferred unless event-triggered proves insufficient.
