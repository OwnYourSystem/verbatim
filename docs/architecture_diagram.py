"""Generate the MindAnchor architecture diagram as a JPEG.

Run:  python docs/architecture_diagram.py
Output: docs/architecture.jpg

Reflects the live Google Cloud deployment: two Cloud Run services (React SPA via
nginx + FastAPI), Cloud SQL Postgres, the Cloud Build CI/CD path, and the
optional Anthropic Claude agent layer.
"""
from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

# ---- palette (app's dark / emerald theme) ----
BG = "#0b1120"
CARD = "#111a2e"
CARD_EDGE = "#243049"
EMERALD = "#34d399"
EMERALD_DK = "#10b981"
VIOLET = "#a78bfa"
BLUE = "#60a5fa"
SLATE = "#94a3b8"
WHITE = "#f1f5f9"
AMBER = "#fbbf24"

fig, ax = plt.subplots(figsize=(13, 9.6), dpi=150)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, 130)
ax.set_ylim(0, 96)
ax.axis("off")


def box(x, y, w, h, title, lines, edge=CARD_EDGE, title_color=WHITE, fill=CARD,
        title_size=11, line_size=8.2):
    ax.add_patch(FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.6,rounding_size=2",
        linewidth=1.7, edgecolor=edge, facecolor=fill, zorder=2))
    ax.text(x + w / 2, y + h - 3.0, title, ha="center", va="top",
            fontsize=title_size, fontweight="bold", color=title_color, zorder=3)
    for i, ln in enumerate(lines):
        ax.text(x + w / 2, y + h - 6.8 - i * 3.5, ln, ha="center", va="top",
                fontsize=line_size, color=SLATE, zorder=3)


def arrow(x1, y1, x2, y2, color=EMERALD, lw=1.9, ls="-", rad=0.0):
    ax.add_patch(FancyArrowPatch(
        (x1, y1), (x2, y2), arrowstyle="-|>", mutation_scale=16,
        linewidth=lw, color=color, zorder=1, linestyle=ls,
        connectionstyle=f"arc3,rad={rad}"))


def label(x, y, text, color=SLATE, size=7.8, style="italic"):
    ax.text(x, y, text, ha="center", va="center", fontsize=size,
            color=color, style=style, zorder=4)


# ---- title ----
ax.text(65, 92.5, "MindAnchor — System Architecture", ha="center",
        fontsize=20, fontweight="bold", color=EMERALD)
ax.text(65, 88.2, "Google Cloud (region europe-north2) · skeleton-first · human-gated AI",
        ha="center", fontsize=10.5, color=SLATE, style="italic")

# ===== RUNTIME PATH (left/center column) =====
# User
box(20, 76, 42, 9, "User  ·  Browser / installable PWA",
    ["HTTPS"], edge=BLUE, line_size=8.5)

# Frontend Cloud Run
box(14, 58, 54, 13, "Frontend  —  Cloud Run  (mindanchor-frontend)",
    ["React + TypeScript + Vite + Tailwind (SPA)",
     "served by nginx · proxies  /api/  →  backend"],
    edge=EMERALD_DK)

# Backend Cloud Run
box(14, 37, 54, 14, "Backend API  —  Cloud Run  (mindanchor)",
    ["FastAPI + uvicorn · SQLAlchemy · single-user JWT",
     "routers: systems · tasks · dashboard · reports",
     "rebalance · intake · agents · pains · auth"],
    edge=EMERALD_DK)

# Cloud SQL
box(14, 18, 54, 12, "Cloud SQL  —  PostgreSQL  (mindanchor-db)",
    ["Alembic migrations 0001–0008",
     "System → Task → Subtask domain model"],
    edge=BLUE)

# AI layer (bottom-right, its own space — clear of the CI/CD column)
box(78, 14, 42, 19, "AI Agent Layer  (optional)",
    ["Anthropic Claude API",
     "Opus (plan) · Sonnet (fast)",
     "emits proposals → you approve",
     "event-triggered, not a loop"],
    edge=VIOLET, title_color=VIOLET)

# runtime arrows
arrow(41, 76, 41, 71.3, color=BLUE)
label(48.5, 73.6, "HTTPS", color=BLUE)
arrow(41, 58, 41, 51.3, color=EMERALD)
label(52.5, 54.6, "/api proxy (HTTPS)", color=EMERALD)
arrow(41, 37, 41, 30.3, color=EMERALD)
label(50.5, 33.6, "psycopg2 · Cloud SQL", color=EMERALD)
arrow(68, 42, 84, 33, color=VIOLET, rad=-0.12)
label(76.5, 39.2, "calls", color=VIOLET)

# ===== CI/CD PATH (right column, top) =====
box(78, 74, 42, 11, "GitHub  ·  OwnYourSystem/MindAnchor",
    ["private repo · push to  main",
     "backend/ · frontend/ · mobile/"],
    edge=CARD_EDGE, title_color=WHITE)

box(78, 60, 42, 9, "Cloud Build  (trigger on main)",
    ["build backend/Dockerfile → push → deploy"],
    edge=AMBER, title_color=AMBER)

box(78, 49, 42, 7, "Artifact Registry",
    ["cloud-run-source-deploy (Docker images)"],
    edge=CARD_EDGE)

arrow(99, 74, 99, 69.3, color=AMBER)
label(105.5, 71.6, "push", color=AMBER)
arrow(99, 60, 99, 56.3, color=AMBER)
arrow(92, 49, 70, 51.3, color=AMBER, ls="--", rad=-0.15)
label(86, 53.8, "deploy image", color=AMBER)

# ---- legend ----
ax.text(14, 11.5, "Runtime request path", color=EMERALD, fontsize=8.6,
        fontweight="bold")
ax.text(14, 8.6, "CI/CD (auto-deploy on git push)", color=AMBER, fontsize=8.6,
        fontweight="bold")
ax.text(14, 5.7, "Optional AI layer", color=VIOLET, fontsize=8.6,
        fontweight="bold")
ax.text(122, 4.2, "regenerate: python docs/architecture_diagram.py",
        ha="right", color="#55607a", fontsize=7, style="italic")

fig.tight_layout(pad=0.4)
import os
out = os.path.join(os.path.dirname(__file__), "architecture.jpg")
fig.savefig(out, facecolor=BG, dpi=150, format="jpg", bbox_inches="tight",
            pad_inches=0.2)
print("wrote", out)
