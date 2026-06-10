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


class StubLLM:
    """Deterministic planner: order open tasks by deadline (earliest first),
    and suggest a prep pre-task for anything due very soon. No AI, no network."""

    def propose(self, context: dict) -> dict:
        tasks = context.get("open_tasks", [])
        today = date.today()

        def sort_key(t: dict):
            d = t.get("deadline")
            return (0, d) if d else (1, "9999-12-31")

        ordered = sorted(tasks, key=sort_key)
        actions: list[dict] = [
            {"type": "reorder", "task_id": t["id"], "position": i}
            for i, t in enumerate(ordered)
        ]

        suggested = None
        for t in ordered:
            d = t.get("deadline")
            if d and (date.fromisoformat(d) - today).days <= PRETASK_HORIZON_DAYS:
                suggested = t
                break
        if suggested is not None:
            actions.append(
                {"type": "add_pretask", "title": f"Prep for: {suggested['title']}"}
            )

        summary = (
            f"Ordered {len(ordered)} open task(s) by deadline (earliest first)."
            + (
                f" Suggested a prep pre-task ahead of the near-term deadline "
                f"'{suggested['title']}'."
                if suggested
                else ""
            )
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
        "You are a specialist agent that owns a single system. Keep its task list "
        "ordered so the most urgent, highest-priority work surfaces first."
    )
    return (
        f"{program}\n\n"
        "You may only PROPOSE changes; the user approves them. Respond with ONLY a "
        "JSON object of the form:\n"
        '{"summary": "<one paragraph>", "actions": [\n'
        '  {"type": "reorder", "task_id": <int>, "position": <int>},\n'
        '  {"type": "add_pretask", "title": "<string>"}\n'
        "]}\n"
        "Use task_ids from the provided context. Do not invent task_ids. "
        "Respect the system's current priority and the immutable deadlines."
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
