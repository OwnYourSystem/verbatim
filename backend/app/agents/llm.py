"""The LLM interface behind the specialist agents.

Two implementations:
- StubLLM   — deterministic, offline. Used when no ANTHROPIC_API_KEY is set
              (and in tests). Lets the whole propose→approve flow work with no
              network or cost.
- AnthropicLLM — real Claude call. Selected automatically once a key is present.

Both return a dict: {"summary": str, "actions": [ {type, ...}, ... ]}.
Actions are validated against schemas.ProposalAction by the orchestrator.
"""
from __future__ import annotations

import json
from datetime import date
from typing import Protocol

from app.core.config import get_settings

# A near-deadline task (within this many days) gets a suggested prep pre-task.
PRETASK_HORIZON_DAYS = 3


class LLMClient(Protocol):
    def propose(self, context: dict) -> dict: ...


# A rough default estimate (hours) for a task the scrum master has to size.
DEFAULT_TASK_ESTIMATE_HOURS = 8.0


class StubLLM:
    """A deterministic, offline 'scrum master' planner. No AI, no network.

    Applies common agile best practices to the system's open work:
    - Orders tasks by priority (1 = highest) then by nearest deadline.
    - Sizes any unestimated task with a default estimate.
    - Assigns a sensible priority to anything left unprioritised, escalating
      items whose deadline is near.
    - Flags risks: overdue work, data-exposure concerns, hour budgets blown,
      and demos with no prep.
    - Schedules near-deadline tasks onto the calendar.
    - Suggests a prep pre-task ahead of the closest deadline.
    """

    def propose(self, context: dict) -> dict:
        tasks = context.get("open_tasks", [])
        today = date.today()
        actions: list[dict] = []
        insights: list[str] = []

        def days_to(d: str | None) -> int | None:
            return (date.fromisoformat(d) - today).days if d else None

        def sort_key(t: dict):
            pr = t.get("priority") or 3
            d = t.get("deadline")
            return (pr, d or "9999-12-31")

        ordered = sorted(tasks, key=sort_key)

        # 1. Re-sequence the backlog by priority then deadline.
        for i, t in enumerate(ordered):
            if t.get("position") != i:
                actions.append({"type": "reorder", "task_id": t["id"], "position": i})

        # 2. Estimate, prioritise and risk-check each task.
        for t in ordered:
            dleft = days_to(t.get("deadline"))
            update: dict = {"type": "update_task", "task_id": t["id"]}
            touched = False

            if not t.get("dedicated_hours"):
                update["dedicated_hours"] = DEFAULT_TASK_ESTIMATE_HOURS
                touched = True
                insights.append(
                    f"Estimated '{t['title']}' at {DEFAULT_TASK_ESTIMATE_HOURS:g}h "
                    "(was unestimated)."
                )

            # Escalate priority for imminent deadlines.
            if dleft is not None and dleft <= 2 and (t.get("priority") or 3) > 1:
                update["priority"] = 1
                touched = True
                insights.append(
                    f"Raised '{t['title']}' to priority 1 — due in {dleft} day(s)."
                )

            if touched:
                actions.append(update)

            # Risk flags (informational insights).
            if dleft is not None and dleft < 0:
                insights.append(
                    f"⚠ OVERDUE: '{t['title']}' was due {abs(dleft)} day(s) ago."
                )
            if t.get("remaining_hours") is not None and t["remaining_hours"] < 0:
                insights.append(
                    f"⚠ Over budget: '{t['title']}' is "
                    f"{abs(t['remaining_hours']):g}h past its estimate."
                )
            if t.get("data_exposure_concern"):
                insights.append(
                    f"🔒 '{t['title']}' is flagged for data-exposure — add a review gate."
                )
            if t.get("required_demo") and not t.get("subtasks"):
                insights.append(
                    f"🎬 '{t['title']}' needs a demo but has no breakdown — "
                    "suggest a 'Prepare demo' subtask."
                )
                actions.append(
                    {
                        "type": "add_subtask",
                        "task_id": t["id"],
                        "title": "Prepare demo",
                        "dedicated_hours": 2.0,
                        "last_checkpoint": "Testing",
                    }
                )

        # 3. Schedule + prep the closest deadline.
        near = next(
            (
                t
                for t in ordered
                if (dl := days_to(t.get("deadline"))) is not None
                and dl <= PRETASK_HORIZON_DAYS
            ),
            None,
        )
        if near is not None:
            actions.append(
                {
                    "type": "schedule",
                    "task_id": near["id"],
                    "day": today.isoformat(),
                    "note": f"Focus block for '{near['title']}'",
                }
            )
            actions.append(
                {
                    "type": "add_pretask",
                    "title": f"Prep for: {near['title']}",
                    "priority": 1,
                    "dedicated_hours": 1.0,
                }
            )

        for msg in insights:
            actions.append({"type": "insight", "kind": "suggestion", "message": msg})

        summary = (
            f"Scrum-master review of {len(ordered)} open task(s): re-sequenced by "
            f"priority and deadline, sized unestimated work, and raised "
            f"{len(insights)} insight(s)."
        )
        return {"summary": summary, "actions": actions}


class AnthropicLLM:
    """Real Claude-backed specialist. Imports the SDK lazily so the app runs
    without `anthropic` installed when the stub is in use."""

    def __init__(self, api_key: str, model: str):
        self._api_key = api_key
        self._model = model

    def propose(self, context: dict) -> dict:
        import anthropic  # lazy: only needed when a key is configured

        client = anthropic.Anthropic(api_key=self._api_key)
        system_prompt = _build_system_prompt(context)
        user_content = json.dumps(context, default=str)

        resp = client.messages.create(
            model=self._model,
            max_tokens=2000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_content}],
        )
        text = "".join(block.text for block in resp.content if block.type == "text")
        return _extract_json(text)


def _build_system_prompt(context: dict) -> str:
    program = context.get("program") or (
        "You are an elite Agile Scrum Master and senior software engineer with "
        "decades of delivery experience, owning a single system. Apply agile best "
        "practices: keep the backlog sequenced by value and risk, size every item, "
        "surface blockers and dependencies early, protect the team from overload, "
        "and make the plan demo-ready."
    )
    return (
        f"{program}\n\n"
        "Priority scale: 1 = highest, 5 = lowest. You may only PROPOSE changes; the "
        "user approves them. Use task_ids from the provided context — never invent "
        "them. Respect immutable deadlines. Respond with ONLY a JSON object:\n"
        '{"summary": "<one short paragraph of PM insight>", "actions": [\n'
        '  {"type": "reorder", "task_id": <int>, "position": <int>},\n'
        '  {"type": "update_task", "task_id": <int>, "priority": <1-5>, '
        '"dedicated_hours": <number>, "status": "todo|in_progress|blocked|done", '
        '"last_checkpoint": "Planning|Development|Testing|Staging|Production", '
        '"deadline": "YYYY-MM-DD", "data_exposure_concern": <bool>, '
        '"required_demo": <bool>, "description": "<string>"},\n'
        '  {"type": "add_task", "title": "<string>", "priority": <1-5>, '
        '"dedicated_hours": <number>, "deadline": "YYYY-MM-DD"},\n'
        '  {"type": "add_pretask", "title": "<string>", "priority": <1-5>},\n'
        '  {"type": "add_subtask", "task_id": <int>, "title": "<string>", '
        '"dedicated_hours": <number>},\n'
        '  {"type": "schedule", "task_id": <int>, "day": "YYYY-MM-DD", '
        '"note": "<string>"},\n'
        '  {"type": "insight", "kind": "risk|blocker|estimate|suggestion|ceremony", '
        '"message": "<string>"}\n'
        "]}\n"
        "Estimate any unestimated work, escalate priority for near deadlines, flag "
        "overdue/over-budget/data-exposure risks, ensure demoable items have a "
        "breakdown, and schedule the most urgent task."
    )


def _extract_json(text: str) -> dict:
    """Parse the model's JSON, tolerating surrounding prose/code fences."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            return json.loads(text[start : end + 1])
        raise


def get_llm() -> LLMClient:
    settings = get_settings()
    if settings.anthropic_api_key:
        return AnthropicLLM(settings.anthropic_api_key, settings.model_planning)
    return StubLLM()


# ── SK suggestion (separate from the rebalance proposal flow) ─────────────────

_HOT_KEYWORDS = {
    "sap", "proprietary", "enterprise", "bespoke", "custom", "rare",
    "advanced", "expert", "ai", "machine learning", "ml", "negotiation",
    "cloud", "architecture", "strategy", "leadership", "patent",
}
_COLD_KEYWORDS = {
    "excel", "word", "basic", "standard", "common", "email", "documentation",
    "report", "meeting", "general", "introduction", "overview",
}


def _stub_suggest_sk(title: str, description: str) -> dict:
    text = (title + " " + description).lower()
    temperature = 5
    for kw in _HOT_KEYWORDS:
        if kw in text:
            temperature = 8
            break
    for kw in _COLD_KEYWORDS:
        if kw in text:
            temperature = 3
            break
    words = [w for w in title.split() if len(w) > 3][:4]
    name = " ".join(words).title() if words else title[:30].title()
    return {
        "name": name,
        "temperature": temperature,
        "justification": (
            "Estimated based on task domain keywords. "
            "Hot skills are rare and not easily replicated; cold skills are teachable."
        ),
    }


def _anthropic_suggest_sk(title: str, description: str, api_key: str, model: str) -> dict:
    import anthropic  # lazy import

    client = anthropic.Anthropic(api_key=api_key)
    prompt = (
        f"Task title: {title}\n"
        f"Description: {description or '(none)'}\n\n"
        "Identify the ONE most valuable specific knowledge earned by completing this task.\n"
        "Rules:\n"
        "- Name it in 2-5 words (e.g. 'SAP BTP Architecture', 'Contract Negotiation')\n"
        "- Temperature 1-10: 1=cold (textbook/teachable), 10=blazing hot (unique/premium)\n"
        "- One-sentence justification\n"
        'Return ONLY valid JSON: {"name":"...","temperature":<int>,"justification":"..."}'
    )
    msg = client.messages.create(
        model=model,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    return _extract_json(raw)


def suggest_sk(title: str, description: str) -> dict:
    """Suggest an SK name + temperature. Auto-selects stub vs real Claude."""
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            return _anthropic_suggest_sk(
                title, description, settings.anthropic_api_key, settings.model_fast
            )
        except Exception:
            pass
    return _stub_suggest_sk(title, description)
