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


_VALID_RATINGS = {"cold", "warm", "hot"}


def _coerce_rating(value: object) -> str:
    """Map any model/legacy output to one of cold/warm/hot.

    Accepts the 3-level strings directly, and also tolerates a legacy 1-10
    numeric temperature so older callers/data degrade gracefully.
    """
    if isinstance(value, str):
        v = value.strip().lower()
        if v in _VALID_RATINGS:
            return v
    if isinstance(value, int | float):
        if value >= 7:
            return "hot"
        if value >= 4:
            return "warm"
        return "cold"
    return "warm"


def _stub_suggest_sk(title: str, description: str) -> dict:
    text = (title + " " + description).lower()
    rating = "warm"
    for kw in _HOT_KEYWORDS:
        if kw in text:
            rating = "hot"
            break
    for kw in _COLD_KEYWORDS:
        if kw in text:
            rating = "cold"
            break
    words = [w for w in title.split() if len(w) > 3][:4]
    name = " ".join(words).title() if words else title[:30].title()
    return {
        "name": name,
        "rating": rating,
        "justification": (
            "Estimated from task domain keywords. HOT knowledge is unique and "
            "not teachable elsewhere; COLD knowledge is textbook and widely available."
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
        "- Rate how UNIQUE and NOT-TEACHABLE-ELSEWHERE the knowledge is, as one of:\n"
        "    HOT  = rare, proprietary, hard to replicate, premium\n"
        "    WARM = moderately specialized\n"
        "    COLD = textbook, widely teachable, commodity\n"
        "- One-sentence justification\n"
        'Return ONLY valid JSON: {"name":"...","rating":"hot|warm|cold","justification":"..."}'
    )
    msg = client.messages.create(
        model=model,
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    data = _extract_json(raw)
    data["rating"] = _coerce_rating(data.get("rating", data.get("temperature")))
    return data


def suggest_sk(title: str, description: str) -> dict:
    """Suggest an SK name + HOT/WARM/COLD rating. Auto-selects stub vs real Claude."""
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            result = _anthropic_suggest_sk(
                title, description, settings.anthropic_api_key, settings.model_fast
            )
            result["rating"] = _coerce_rating(result.get("rating"))
            return result
        except Exception:
            pass
    return _stub_suggest_sk(title, description)


# ── Wall of Pains ─────────────────────────────────────────────────────────────

_STUB_PAINS = [
    {
        "title": "Real-time data quality monitoring at pipeline scale",
        "description": (
            "Teams running high-volume Kafka/Flink pipelines can't detect schema drift, "
            "null explosions, or distribution shifts in real time without halting the pipeline. "
            "Existing tools (Great Expectations, Soda) are batch-first and add 30-60 min latency."
        ),
        "source_url": "https://seattledataguy.substack.com",
        "source_platform": "Substack",
        "area": "data_engineering",
    },
    {
        "title": "Vector DB cost explosion at enterprise scale",
        "description": (
            "Pinecone, Weaviate, and Qdrant bills become unpredictable past 10M vectors. "
            "Self-hosting cuts cost but the operational burden is prohibitive. "
            "Teams need a managed hybrid sparse-dense index with predictable pricing."
        ),
        "source_url": "https://thedataengineering.substack.com",
        "source_platform": "Substack",
        "area": "data_engineering",
    },
    {
        "title": "dbt model contract testing across team boundaries",
        "description": (
            "Multiple squads own hundreds of dbt models; cross-team schema changes break "
            "downstream consumers silently. No lightweight contract-testing layer exists "
            "between dbt producers and their consumers."
        ),
        "source_url": "https://roundup.getdbt.com",
        "source_platform": "Substack",
        "area": "data_engineering",
    },
    {
        "title": "LLM hallucination guardrails for enterprise RAG",
        "description": (
            "RAG pipelines return confident but wrong answers when retrieved chunks "
            "are irrelevant. Ground-truth evaluation at scale is expensive and "
            "existing guardrails are too slow or costly for SMB deployments."
        ),
        "source_url": "https://www.latent.space",
        "source_platform": "Substack",
        "area": "ai",
    },
    {
        "title": "AI agent reliability in multi-step production workflows",
        "description": (
            "Autonomous agents built on function-calling LLMs fail silently mid-chain, "
            "produce partial outputs, and lack restart-from-checkpoint. "
            "Failure modes are opaque and hard to debug in production."
        ),
        "source_url": "https://www.agentrecap.com",
        "source_platform": "Substack",
        "area": "ai",
    },
    {
        "title": "Prompt version control and regression testing at scale",
        "description": (
            "Each data scientist maintains their own prompt library in different formats. "
            "No version control, no regression testing, no A/B framework. "
            "Prompt drift degrades production models invisibly over months."
        ),
        "source_url": "https://eugeneyan.com",
        "source_platform": "Blog",
        "area": "ai",
    },
    {
        "title": "AI governance and audit trails for regulated industries",
        "description": (
            "Banks and insurers need explainability, audit trails, and data residency. "
            "Existing LLM APIs don't provide the attestation that GDPR, SR 11-7, "
            "and the EU AI Act require from compliance teams."
        ),
        "source_url": "https://thesequence.substack.com",
        "source_platform": "Substack",
        "area": "ai",
    },
    {
        "title": "ML model drift detection without retraining overhead",
        "description": (
            "Statistical drift tests create false positives on benign shifts, "
            "causing teams to retrain unnecessarily. "
            "A causal drift detector tuned per-feature would cut retraining by 60-70%."
        ),
        "source_url": "https://mlops.community",
        "source_platform": "Community",
        "area": "ml",
    },
    {
        "title": "Reproducible ML experiments across heterogeneous environments",
        "description": (
            "GPU cluster + local Mac + cloud notebook = three diverging environments. "
            "Seeds aren't set consistently; results differ between researchers "
            "and can't be audited for compliance or publication."
        ),
        "source_url": "https://newsletter.practicalai.io",
        "source_platform": "Substack",
        "area": "ml",
    },
    {
        "title": "Affordable fine-tuning pipeline for domain-specific LLMs",
        "description": (
            "Full fine-tuning of 7B+ models costs thousands per run. "
            "LoRA reduces cost but introduces adapter management complexity. "
            "Teams need a managed pipeline with cost ceilings and automatic evaluation."
        ),
        "source_url": "https://www.interconnects.ai",
        "source_platform": "Substack",
        "area": "ml",
    },
]


def discover_pains(area: str = "all") -> list[dict]:
    """Return pains for the Wall of Pains. Stub returns curated real pains."""
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            return _anthropic_discover_pains(area, settings.anthropic_api_key, settings.model_fast)
        except Exception:
            pass
    pains = _STUB_PAINS
    if area and area != "all":
        pains = [p for p in pains if p["area"] == area]
    return pains


def _anthropic_discover_pains(area: str, api_key: str, model: str) -> list[dict]:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    area_filter = (
        "" if area == "all" else f" Focus only on {area.replace('_', ' ')}."
    )
    prompt = (
        "List 8 real, current (2025-2026) painful unsolved problems in "
        f"Data Engineering, ML, and AI that practitioners face.{area_filter}\n"
        "For each: title (max 80 chars), description (2-3 sentences on why it "
        "hurts and what is missing), source_url (real Substack/blog/community URL), "
        "source_platform (Substack|Blog|Reddit|LinkedIn|Community), "
        "area (data_engineering|ml|ai).\n"
        'Return ONLY a JSON array: [{"title":"...","description":"...",'
        '"source_url":"...","source_platform":"...","area":"..."}]'
    )
    msg = client.messages.create(
        model=model,
        max_tokens=1800,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = msg.content[0].text.strip()
    data = _extract_json(raw)
    return data if isinstance(data, list) else data.get("pains", [])


def assist_project(title: str, description: str) -> dict:
    """Generate a monetization project brief from a pain."""
    settings = get_settings()
    if settings.anthropic_api_key:
        try:
            return _anthropic_assist_project(
                title, description, settings.anthropic_api_key, settings.model_fast
            )
        except Exception:
            pass
    return _stub_assist_project(title, description)


def _stub_assist_project(title: str, description: str) -> dict:
    w = (title + " " + (description or "")).lower()
    if any(k in w for k in ("monitor", "quality", "observ")):
        mono = "saas"
        audience = "Data engineering teams at mid-to-large companies using Kafka or Flink"
    elif any(k in w for k in ("cost", "budget", "expensive", "price")):
        mono = "open_source_premium"
        audience = "Startups and scale-ups with growing data infrastructure bills"
    elif any(k in w for k in ("agent", "llm", "hallucin", "rag")):
        mono = "api_product"
        audience = "Software teams integrating AI/LLMs into customer-facing products"
    elif any(k in w for k in ("compliance", "governance", "audit", "regulat")):
        mono = "consulting"
        audience = "Regulated-industry companies (finance, insurance, healthcare)"
    elif any(k in w for k in ("fine-tun", "train", "experiment", "repro")):
        mono = "saas"
        audience = "ML engineers at companies with active model training programs"
    else:
        mono = "saas"
        audience = "Data and ML practitioners at technology companies"
    return {
        "name": " ".join(title.split()[:5]),
        "problem_statement": (
            description or f"Practitioners face {title.lower()} with no reliable tooling available."
        ),
        "target_audience": audience,
        "monetization_model": mono,
        "justification": (
            "Niche B2B problem + clear buyer persona + recurring need = "
            "strong product-market fit for a focused SaaS or API offering."
        ),
    }


def _anthropic_assist_project(
    title: str, description: str, api_key: str, model: str
) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=api_key)
    prompt = (
        f"Pain: {title}\nContext: {description}\n\n"
        "You are an AI product strategist. Define a project to solve this pain and monetize it:\n"
        "- name: product/project name (2-5 words)\n"
        "- problem_statement: 2-sentence crisp problem + who suffers\n"
        "- target_audience: specific buyer persona (role, company size, industry)\n"
        "- monetization_model: one of "
        "saas|api_product|consulting|course|open_source_premium|marketplace\n"
        "- justification: 1-sentence why this model fits\n"
        'Return ONLY JSON: {"name":"...","problem_statement":"...",'
        '"target_audience":"...","monetization_model":"...","justification":"..."}'
    )
    msg = client.messages.create(
        model=model,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return _extract_json(msg.content[0].text.strip())
