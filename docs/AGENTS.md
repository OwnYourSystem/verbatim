# The AI brain — agent layer

MindAnchor's agents are **event-triggered specialists**, one per System, coordinated by an **orchestrator**. They are **human-gated**: an agent only ever produces a *proposal*; nothing is applied until you approve it.

## Components (backend/app/agents/)

- **`llm.py`** — the LLM interface.
  - `LLMClient` protocol: `propose(context) -> {"summary", "actions"}`.
  - `StubLLM` — deterministic, offline. Orders open tasks by deadline and suggests a prep pre-task for anything due within 3 days. Used when no API key is set (and in tests).
  - `AnthropicLLM` — real Claude call (lazy-imports `anthropic`). Sends the System's context + the agent's role program, asks for a strict-JSON plan.
  - `get_llm()` — returns `AnthropicLLM` if `ANTHROPIC_API_KEY` is set, else `StubLLM`.
- **`orchestrator.py`**
  - `build_context` — read-only snapshot for a System (name, current priority, the editable `AgentProgram`, open tasks).
  - `propose_for_system` — runs the agent, **validates** its actions against `schemas.ProposalAction` (drops anything malformed), stores a `RebalanceProposal` (status = `pending`).
  - `apply_proposal` — executes an approved proposal's actions; only touches tasks in its own System.
  - `decide_proposal` — approve (apply + mark approved) or reject.

## Proposal actions

Validated, allow-listed action types the agent may emit:

| Action | Effect on approval |
|---|---|
| `reorder` `{task_id, position}` | Sets the task's position (only within the agent's System). |
| `add_pretask` `{title}` | Creates a new task at the front of the System's list. |

Unknown/invalid actions are discarded at proposal time — the model can't make the app do arbitrary things.

## API (propose → approve)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/systems/{id}/rebalance` | Ask the System's specialist to propose a plan (pending). |
| `GET` | `/rebalance-proposals?status=&system_id=` | List proposals. |
| `GET` | `/rebalance-proposals/{id}` | One proposal. |
| `POST` | `/rebalance-proposals/{id}/approve` | Apply it. |
| `POST` | `/rebalance-proposals/{id}/reject` | Discard it. |

## Enabling the real Claude agent

1. Put your key in `backend/.env`: `ANTHROPIC_API_KEY=sk-ant-...` (never committed).
2. Optionally set `MODEL_PLANNING` (default `claude-opus-4-8`).
3. Restart the backend. `get_llm()` now returns `AnthropicLLM` automatically — no code change.

Per-System behavior is shaped by that System's `AgentProgram.content` (an editable role instruction file), assigned via `/agent-assignments`.

## Notes / future (Part B continued)

- Triggering is currently explicit (`POST .../rebalance`). The `emit_event` hook in `services.py` already fires on every change; wiring it to auto-propose (with debounce + a cost ceiling) is a later step.
- The proposal UI (review + approve/reject in the browser) is Phase 5.
