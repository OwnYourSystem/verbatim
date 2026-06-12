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


def _wi(title: str, **kw) -> dict:
    """Build a fully-attributed work item (scrum-master defaults for every field)."""
    base = {
        "title": title,
        "description": kw.get("description"),
        "status": kw.get("status", "todo"),
        "priority": kw.get("priority", 3),
        "deadline": kw.get("deadline"),
        "dedicated_hours": kw.get("dedicated_hours", 4.0),
        "data_exposure_concern": kw.get("data_exposure_concern", False),
        "last_checkpoint": kw.get("last_checkpoint", "Planning"),
        "required_demo": kw.get("required_demo", False),
    }
    if "subtasks" in kw:
        base["subtasks"] = kw["subtasks"]
    return base


def _starter_tasks(fields: dict) -> list[dict]:
    """A deterministic starter backlog with every attribute filled in, sequenced
    by priority the way an experienced scrum master would seed a new system."""
    return [
        _wi(
            "Define scope and success criteria",
            priority=1,
            dedicated_hours=6.0,
            last_checkpoint="Planning",
            description="Lock down what 'done' means before any build work starts.",
            subtasks=[
                _wi("List concrete deliverables", priority=1, dedicated_hours=2.0),
                _wi("Write down the constraints", priority=2, dedicated_hours=2.0),
            ],
        ),
        _wi(
            "Plan the first deliverable",
            priority=2,
            dedicated_hours=8.0,
            last_checkpoint="Development",
            description="Break the first slice of value into buildable steps.",
            subtasks=[_wi("Break it into steps", priority=2, dedicated_hours=3.0)],
        ),
        _wi(
            "Set up tracking and cadence",
            priority=3,
            dedicated_hours=3.0,
            last_checkpoint="Planning",
            required_demo=True,
            description="Stand up the ritual cadence: standup, review, retro.",
            subtasks=[],
        ),
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
            "You are an elite Agile Scrum Master and senior software engineer with "
            "decades of experience, conducting a structured intake interview to "
            "define a new 'system' (a top-level work domain). Ask ONE focused "
            "question at a time. Cover: name, purpose, goals, constraints, "
            "dependencies, delivery expectations. Do not assume or skip. When you "
            "have enough, propose a starter backlog where you FILL IN EVERY "
            "ATTRIBUTE of each task and subtask using best-practice judgement.\n\n"
            "Priority scale: 1 = highest, 5 = lowest. last_checkpoint is the "
            "functional phase: Planning|Development|Testing|Staging|Production.\n\n"
            "Respond with ONLY JSON, one of:\n"
            '{"done": false, "question": "<next question>"}\n'
            "or\n"
            '{"done": true, "proposal": {"system": {"name": "...", "purpose": "...", '
            '"goals": "...", "constraints": "...", "dependencies": "...", '
            '"delivery_expectations": "..."}, "tasks": [{"title": "...", '
            '"description": "...", "status": "todo", "priority": <1-5>, '
            '"deadline": "YYYY-MM-DD or null", "dedicated_hours": <number>, '
            '"data_exposure_concern": <bool>, "last_checkpoint": "Planning", '
            '"required_demo": <bool>, "subtasks": [{"title": "...", '
            '"description": "...", "status": "todo", "priority": <1-5>, '
            '"deadline": null, "dedicated_hours": <number>, '
            '"data_exposure_concern": <bool>, "last_checkpoint": "Planning", '
            '"required_demo": <bool>}]}]}}'
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
