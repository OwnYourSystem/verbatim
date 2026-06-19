"""Generate the MindAnchor architecture diagram as a JPEG.

Run:  python docs/architecture_diagram.py
Output: docs/architecture.jpg
"""
from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

# ---- palette (matches the app's dark / emerald theme) ----
BG = "#0b1120"
CARD = "#111a2e"
CARD_EDGE = "#243049"
EMERALD = "#34d399"
EMERALD_DK = "#10b981"
VIOLET = "#a78bfa"
SLATE = "#94a3b8"
WHITE = "#f1f5f9"
AMBER = "#fbbf24"

fig, ax = plt.subplots(figsize=(13, 9), dpi=140)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 130)
ax.set_ylim(0, 90)
ax.axis("off")


def box(x, y, w, h, title, lines, edge=CARD_EDGE, title_color=WHITE, fill=CARD):
    p = FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.6,rounding_size=2",
        linewidth=1.6, edgecolor=edge, facecolor=fill, zorder=2,
    )
    ax.add_patch(p)
    ax.text(x + w / 2, y + h - 3.2, title, ha="center", va="top",
            fontsize=11, fontweight="bold", color=title_color, zorder=3)
    for i, ln in enumerate(lines):
        ax.text(x + w / 2, y + h - 7.4 - i * 3.6, ln, ha="center", va="top",
                fontsize=8.3, color=SLATE, zorder=3)
    return (x + w / 2, y, x + w / 2, y + h)  # bottom-center, top-center helpers


def arrow(x1, y1, x2, y2, color=EMERALD, style="-|>", lw=1.8, ls="-"):
    a = FancyArrowPatch(
        (x1, y1), (x2, y2), arrowstyle=style, mutation_scale=16,
        linewidth=lw, color=color, zorder=1, linestyle=ls,
        connectionstyle="arc3,rad=0",
    )
    ax.add_patch(a)


# ---- title ----
ax.text(65, 87, "MindAnchor — System Architecture", ha="center",
        fontsize=20, fontweight="bold", color=EMERALD)
ax.text(65, 82.5, "Skeleton-first · Human-gated AI · Event-triggered agents",
        ha="center", fontsize=10.5, color=SLATE, style="italic")

# ---- CLIENT TIER ----
box(8, 66, 46, 12, "Client  (PWA)",
    ["React + TypeScript + Vite + Tailwind",
     "Installable on mobile · offline service worker"],
    edge=EMERALD_DK)
box(76, 66, 46, 12, "Vercel  (static host + CDN)",
    ["Serves built PWA assets",
     "Rewrites /api/* → backend"],
    edge=CARD_EDGE)

# ---- API TIER ----
box(8, 44, 114, 16, "Backend API  —  FastAPI on Render (Docker)",
    ["REST routers: systems · tasks · subtasks · calendar · dashboard · reports · auth · rebalance · intake",
     "Pydantic schemas (validation)   ·   SQLAlchemy ORM   ·   single-user JWT auth (bcrypt)",
     "Domain services: priority inheritance · rule-based daily focus · computed hours · change-event hook"],
    edge=EMERALD_DK, title_color=WHITE)

# ---- AI / AGENT LAYER ----
box(8, 22, 54, 16, "AI Agent Layer  (optional, on top)",
    ["Orchestrator → specialist agents (per System)",
     "Anthropic Claude: Opus (plan) · Sonnet (fast)",
     "Emits RebalanceProposal → you approve/reject",
     "Event-triggered, NOT continuous loops"],
    edge=VIOLET, title_color=VIOLET)

# ---- DATA TIER ----
box(76, 22, 46, 16, "PostgreSQL  (Render)",
    ["System → Task → Subtask hierarchy",
     "Priority · FocusBlock · TimeLog",
     "RebalanceProposal · CheckIn · User",
     "Alembic migrations (versioned schema)"],
    edge=CARD_EDGE)

# ---- EXTERNAL ----
box(8, 4, 54, 12, "Anthropic API  (external)",
    ["Claude models — called only on user events",
     "Strict-JSON contracts · cost-bounded"],
    edge=AMBER, title_color=AMBER)
box(76, 4, 46, 12, "Secrets  (Render env vars)",
    ["PASSWORD_HASH · JWT_SECRET",
     "ANTHROPIC_API_KEY · DATABASE_URL"],
    edge=CARD_EDGE)

# ---- arrows ----
arrow(31, 66, 31, 60, EMERALD)                       # client -> API (direct dev)
arrow(99, 66, 99, 60, EMERALD)                       # vercel -> API
arrow(54, 72, 76, 72, SLATE, ls="--", lw=1.4)        # client <-> vercel (served by)
arrow(35, 44, 35, 38, VIOLET)                        # API -> agent layer
arrow(35, 38, 35, 44, VIOLET)                        # agent -> API (proposals back)
arrow(95, 44, 95, 38, EMERALD)                       # API -> DB
arrow(99, 38, 99, 44, EMERALD)                       # DB -> API
arrow(35, 22, 35, 16, AMBER)                         # agent -> anthropic
arrow(99, 22, 99, 16, SLATE, ls="--", lw=1.4)        # DB <- secrets

# legend
legend = [
    mpatches.Patch(color=EMERALD_DK, label="Core (always works without AI)"),
    mpatches.Patch(color=VIOLET, label="AI layer (additive, human-gated)"),
    mpatches.Patch(color=AMBER, label="External / secrets"),
]
ax.legend(handles=legend, loc="lower center", bbox_to_anchor=(0.5, -0.04),
          ncol=3, frameon=False, fontsize=9, labelcolor=SLATE)

plt.tight_layout()
fig.savefig("docs/architecture.jpg", format="jpg", dpi=140,
            facecolor=BG, bbox_inches="tight")
print("wrote docs/architecture.jpg")
