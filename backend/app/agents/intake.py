"""System intake interview.

Asks one question at a time to fully define a new System, then proposes a
starter task tree. Two implementations, mirroring llm.py:
- StubIntake     — deterministic, offline (fixed question sequence). No key/network.
- AnthropicIntake — Claude-driven conversational intake.

`next_step(history)` returns a dict shaped like schemas.IntakeStep:
  {"done": False, "question": "..."}            # ask the user this next
  {"done": True, "proposal": {system, tasks}}   # enough info gathered
"""
from __future__ import annotations

from typing import Protocol

from app.agents.llm import _extract_json
from app.core.config import get_settings

# Ordered intake questions. Each maps to a System field (first is the name).
QUESTIONS: list[tuple[str, str]] = [
    ("name", "What is the name of this system?"),
    ("purpose", "In one or two sentences, what is the core purpose of this system?"),
    ("goals", "What concrete goals or outcomes do you want from it?"),
    ("constraints", "What constraints or limits apply (time, tools, scope)?"),
    ("dependencies", "What does this system depend on (people, services, other systems)?"),
    ("delivery_expectations", "What are the delivery expectations (cadence, deadlines)?"),
]


class IntakeClient(Protocol):
    def next_step(self, history: list[dict]) -> dict: ...


def _starter_tasks(fields: dict) -> list[dict]:
    """A small, deterministic starter task tree derived from the answers."""
    return [
        {
            "title": "Define scope and success criteria",
            "subtasks": [
                {"title": "List concrete deliverables"},
                {"title": "Write down the constraints"},
            ],
        },
        {
            "title": "Plan the first deliverable",
            "subtasks": [{"title": "Break it into steps"}],
        },
        {
            "title": "Set up tracking and cadence",
            "subtasks": [],
        },
    ]


class StubIntake:
    """Walks the fixed QUESTIONS list, then proposes a starter tree. Offline."""

    def next_step(self, history: list[dict]) -> dict:
        idx = len(history)
        if idx < len(QUESTIONS):
            return {"done": False, "question": QUESTIONS[idx][1]}

        # All answered — map answers (in order) onto System fields.
        fields: dict = {}
        for (field, _q), item in zip(QUESTIONS, history, strict=False):
            fields[field] = (item.get("answer") or "").strip()
        if not fields.get("name"):
            fields["name"] = "New System"

        return {
            "done": True,
            "proposal": {"system": fields, "tasks": _starter_tasks(fields)},
        }


class AnthropicIntake:
    """Claude-driven intake. Asks one question at a time; emits a JSON proposal
    once it has enough to define the system."""

    def __init__(self, api_key: str, model: str):
        self._api_key = api_key
        self._model = model

    def next_step(self, history: list[dict]) -> dict:
        import anthropic  # lazy

        client = anthropic.Anthropic(api_key=self._api_key)
        transcript = "\n".join(
            f"Q: {h.get('question', '')}\nA: {h.get('answer', '')}" for h in history
        )
        system_prompt = (
            "You are conducting a structured intake interview to define a new "
            "'system' (a top-level work domain) for a personal productivity tool. "
            "Ask ONE focused question at a time. Cover: name, purpose, goals, "
            "constraints, dependencies, delivery expectations. Do not assume or skip. "
            "When you have enough to define the system, propose a small starter task "
            "tree.\n\n"
            "Respond with ONLY JSON, one of:\n"
            '{"done": false, "question": "<next question>"}\n'
            "or\n"
            '{"done": true, "proposal": {"system": {"name": "...", "purpose": "...", '
            '"goals": "...", "constraints": "...", "dependencies": "...", '
            '"delivery_expectations": "..."}, "tasks": [{"title": "...", '
            '"subtasks": [{"title": "..."}]}]}}'
        )
        resp = client.messages.create(
            model=self._model,
            max_tokens=1500,
            system=system_prompt,
            messages=[{"role": "user", "content": transcript or "Begin the interview."}],
        )
        text = "".join(b.text for b in resp.content if b.type == "text")
        return _extract_json(text)


def get_intake() -> IntakeClient:
    settings = get_settings()
    if settings.anthropic_api_key:
        return AnthropicIntake(settings.anthropic_api_key, settings.model_planning)
    return StubIntake()
