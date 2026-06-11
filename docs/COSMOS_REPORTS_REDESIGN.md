# Reports Page — Cosmos Redesign Spec

Senior product designer + UI engineer pass. Aesthetic direction: exotic sci-fi "cosmic" for modern SaaS.
Scope: visual and interaction redesign only — no new features, no IA changes.

---

## 1. UI Audit — Current State

Observations taken from the live page at `mind-anchor-alpha.vercel.app/reports` (1440px and 390px viewports) plus source code inspection.

### 10 Highest-Impact Issues / Opportunities

1. Visual hierarchy is flat. Title, tab bar, card heading, and section headings all feel the same weight. There is no clear tier-1 / tier-2 / tier-3 rhythm.

2. The tab bar (weekly / monthly / on-demand) is a plain pill group with no selected-state personality. It reads as a toggle, not a navigation moment. Selected state is only distinguished by a slightly lighter background.

3. Section headings ("BEHIND", "COMING UP", "COMPLETION") use all-caps small text in slate-500, which is barely visible against the card background. They carry the highest semantic value on the page but the lowest visual weight.

4. Report items render as a plain disc-bulleted list. Data points (blocked tasks, deadlines, percentages) have no visual differentiation — a blocked task looks identical to a healthy metric.

5. The "morning briefing and notifications" card sits below the report content with no visual separation from the report proper. It reads as part of the report rather than a distinct utility zone.

6. No loading skeleton — the page flashes blank, then content appears. On a cold Render wake (30-second delay) this looks broken.

7. Typography is entirely one weight family (Inter 400/600). Numbers and metrics have no tabular/monospace treatment — percentages and dates are hard to scan.

8. Color is near-monochromatic (all slate). Status signals (blocked = amber, complete = emerald) exist in StatusBadge but are not used in the report sections — a "blocked" line looks the same as an "on-track" line.

9. The "Generated at" timestamp is slate-500 tiny text, hidden below the summary. It is the trust signal that tells the user the report is fresh — it should be surfaced.

10. Mobile layout is a linear stack with no content prioritization. On 390px the tab bar still fits but wastes padding, and section items have no left-edge affordance to scan vertically.

---

## 2. Cosmos Design Direction

### 6 Design Principles

1. Depth over flatness. Every surface has a z-layer: deep space (background), nebula layer (ambient glow), hull (cards), glass (panels), instruments (data), controls (interactive).

2. Signal through color, not just shape. Status is always communicated with a colored glow or tint — blocked glows amber, complete glows emerald, neutral is cool blue-violet.

3. Tabular numerals everywhere. All percentages, dates, and counts use a monospace/tabular figure variant so columns are scannable at a glance.

4. Motion is purposeful and restrained. Microinteractions acknowledge state transitions; they never animate for decoration alone.

5. Legibility under glass. Every text element meets WCAG AA (4.5:1 for body, 3:1 for large) even when rendered over blurred gradient panels.

6. Reduce-motion is a first-class path. All animations have an instant, opacity-only fallback under `prefers-reduced-motion`.

### Mood Description

Deep observatory at 3 AM. The interface feels like a cockpit console floating above a nebula — luminous data points hover in dark glass, star-field noise fills the void behind card surfaces, and status signals pulse with the calm urgency of mission control. The palette is black space, cool indigo, and vivid signal colors (emerald for healthy, amber for caution, rose for critical). Glassmorphism is used sparingly — only on overlay panels — because true space hardware has weight.

### Art Direction A — Nebula Glass

Blurred glass cards with `backdrop-filter: blur(24px)`. Gradient borders using conic-gradient with slow rotation animation. Star-field canvas overlay at 4% opacity. Rich color — violet, fuchsia, cyan all present. Tab bar is a glowing pill that slides between tabs with a spring transition.

### Art Direction B — Stellar Minimal

Near-black flat panels with a single-pixel luminous border. No blur. Monochromatic palette of indigo-950 to slate-900 with one accent color per semantic state. Star-field expressed as a CSS noise texture (SVG filter), not canvas. Extremely high whitespace. Tab bar is an underline that slides.

### Primary Direction: A — Nebula Glass

Rationale: MindAnchor is a personal AI productivity OS. Its brand positioning (anchor in the mind, AI as a co-pilot) maps naturally to a rich, immersive environment. Nebula Glass communicates intelligence and depth without becoming a game UI. Stellar Minimal would read as a generic dark SaaS — appropriate for enterprise but underselling the product's character. Nebula Glass is also more distinctive in the productivity tool market.

---

## 3. Redesign Spec

### 3.1 Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (240px fixed, desktop only)                      │
│  logo · nav links · system version                       │
├─────────────────────────────────────────────────────────┤
│ Main content (max-width 960px, centered, px-8 py-10)    │
│                                                          │
│  [Page header]                                           │
│    Title: "Reports"         Freshness badge (generated) │
│    Subtitle                                              │
│                                                          │
│  [Tab bar — sticky below header on scroll]              │
│    Weekly · Monthly · On-demand                          │
│    Glow-pill indicator slides between tabs               │
│                                                          │
│  [Report card — 100% width]                             │
│    Glass panel: summary row + freshness                  │
│    Section grid (2 col desktop, 1 col mobile)            │
│      [Section: Behind]    [Section: Coming Up]           │
│      [Section: Completion]                               │
│                                                          │
│  [Briefing + Notifications — distinct zone below fold]  │
│    Dimmer panel, icon, copy, 2 action buttons            │
└─────────────────────────────────────────────────────────┘
```

Grid: 12-column, 24px gutter. Report sections use a 2-up grid on ≥768px, single column below.
Spacing scale: 4px base. Main content padding: 40px top, 32px horizontal.
Tab bar sticks at top 0 on desktop (behind the sidebar top edge) and scrolls with content on mobile.

### 3.2 Visual System — CSS Token Block

```css
:root {
  /* Space — background layers */
  --color-void:          #03040a;   /* deepest background */
  --color-space:         #080c18;   /* page bg */
  --color-deep:          #0b1025;   /* card base */
  --color-hull:          #0f1630;   /* card surface */

  /* Nebula — ambient accent */
  --color-nebula-1:      rgba(99, 60, 255, 0.18);   /* violet glow */
  --color-nebula-2:      rgba(0, 210, 180, 0.10);   /* cyan glow */
  --color-nebula-3:      rgba(255, 80, 160, 0.08);  /* fuchsia glow */

  /* Signal — semantic status */
  --color-signal-ok:     #00e5a0;   /* emerald — healthy / done */
  --color-signal-warn:   #f5a623;   /* amber — caution / coming up */
  --color-signal-crit:   #ff4b6e;   /* rose — blocked / critical */
  --color-signal-idle:   #6b82b5;   /* blue-slate — neutral */

  /* Glass panels */
  --glass-bg:            rgba(15, 22, 48, 0.55);
  --glass-border:        rgba(120, 140, 220, 0.18);
  --glass-blur:          24px;

  /* Typography */
  --font-sans:           "Inter var", ui-sans-serif, system-ui;
  --font-mono:           "JetBrains Mono", "Fira Code", ui-monospace;

  /* Glows */
  --glow-ok:             0 0 16px rgba(0, 229, 160, 0.35);
  --glow-warn:           0 0 16px rgba(245, 166, 35, 0.35);
  --glow-crit:           0 0 16px rgba(255, 75, 110, 0.35);
  --glow-ui:             0 0 20px rgba(99, 60, 255, 0.25);

  /* Borders */
  --border-subtle:       1px solid rgba(120, 140, 220, 0.12);
  --border-glass:        1px solid rgba(120, 140, 220, 0.20);
  --border-glow-ok:      1px solid rgba(0, 229, 160, 0.40);
  --border-glow-warn:    1px solid rgba(245, 166, 35, 0.40);
  --border-glow-crit:    1px solid rgba(255, 75, 110, 0.40);

  /* Motion */
  --ease-spring:         cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-smooth:         cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast:            120ms;
  --dur-base:            220ms;
  --dur-slow:            380ms;

  /* Focus ring */
  --focus-ring:          0 0 0 3px rgba(99, 60, 255, 0.55);
}
```

Star-field treatment: `background-image: url("data:image/svg+xml,<svg ...noise SVG...>")` at 3% opacity + two radial-gradient blobs (violet top-right, cyan bottom-left) at 14% opacity, composited on `--color-space` body background.

### 3.3 Typography System

Font pairing:
- Headings: Inter var, weight 800, tracking -0.03em
- Body: Inter var, weight 400, line-height 1.6
- Metrics/numbers: JetBrains Mono (subset to numerals + %) — tabular-nums, weight 600
- Labels/caps: Inter var, weight 600, letter-spacing 0.12em, font-size 10px

Scale (rem, base 16px):
- `--text-xs`:   0.6875rem  (11px) — timestamps, labels
- `--text-sm`:   0.8125rem  (13px) — report items, body
- `--text-base`: 1rem       (16px) — card summaries
- `--text-lg`:   1.125rem   (18px) — section headings
- `--text-xl`:   1.5rem     (24px) — page subtitle
- `--text-2xl`:  2rem       (32px) — page title
- `--text-display`: 3.5rem  (56px) — hero metric (future)

Numeral styling for metrics: all percentage values and counts use `font-variant-numeric: tabular-nums` with `--font-mono`. Wrap in `<span class="metric">` so the style is scoped.

### 3.4 Component Specs

#### Tab Bar
- Container: pill-shaped, bg `--glass-bg`, border `--border-glass`, `backdrop-filter: blur(12px)`, rounded-2xl, p-1
- Each tab: text-sm font-semibold, px-5 py-2, rounded-xl, color `--color-signal-idle`
- Active tab: absolutely-positioned sliding pill, bg linear-gradient(135deg, `#6b21ff`, `#00e5a0`), text white, box-shadow `--glow-ui`
- Transition: active pill translates with `var(--dur-base) var(--ease-spring)` (JS-measured width/offset)
- Hover inactive: text white, bg `rgba(120,140,220,0.08)`
- Disabled: opacity 0.38, pointer-events none
- Focus ring: `var(--focus-ring)` on keyboard focus, offset 2px

#### Report Card (Glass Panel)
- Container: bg `--glass-bg`, border `--border-glass`, `backdrop-filter: blur(var(--glass-blur))`, rounded-3xl, p-6
- Outer wrapper has a `box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px rgba(0,0,0,0.4)`
- Header row: title left, freshness badge right
- Freshness badge: `font-family: --font-mono`, 11px, color `--color-signal-ok` if < 1 hour, `--color-signal-warn` if > 1 hour, `--color-signal-idle` if unknown
- Summary text: `--text-base`, color rgba(210,220,255,0.75), italic style for narrative feel

#### Section Cards (inside Report Card)
- Each section is a sub-panel: bg `rgba(8,12,24,0.60)`, border `--border-subtle`, rounded-2xl, p-4
- Section heading: 10px, all-caps, letter-spacing 0.12em, color corresponding to semantic:
  - "Behind" → `--color-signal-crit`, left border 2px `--color-signal-crit`, glow `--glow-crit`
  - "Coming Up" → `--color-signal-warn`, left border 2px `--color-signal-warn`
  - "Completion" → `--color-signal-ok`, left border 2px `--color-signal-ok`
  - Neutral → `--color-signal-idle`
- Each item: flex row, left dot (4px circle, semantic color), text `--text-sm`, color rgba(200,210,255,0.85)
- Metrics (percentages): `<span class="metric">` — monospace, `--color-signal-ok` for ≥80%, `--color-signal-warn` for 40–79%, `--color-signal-crit` for < 40%

#### Buttons
- Primary (Show briefing now): bg gradient 135deg `#00c27a` → `#00e5a0`, text `#03040a`, font-weight 700, rounded-xl, px-5 py-2.5, box-shadow `--glow-ok`. Hover: brightness(1.1). Active: scale(0.97). Disabled: opacity 0.35.
- Secondary (Enable notifications): bg `rgba(99,60,255,0.15)`, border `1px solid rgba(99,60,255,0.35)`, text rgba(180,160,255,0.9), rounded-xl, px-5 py-2.5. Hover: bg `rgba(99,60,255,0.25)`, glow `--glow-ui`. Active: scale(0.97).
- Focus: `var(--focus-ring)` on all buttons, offset 2px, never removed for keyboard users.

#### Loading Skeleton
- Three shimmer bones matching the section card layout
- Gradient: `linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)` animated `background-position` over 1.4s ease-in-out infinite
- `prefers-reduced-motion`: static bones, no animation

#### Toast / Notification Status
- Bottom-center fixed, 320px wide, glass panel, border colored by semantic state
- Slide-up entrance: `translateY(16px) → 0`, opacity 0 → 1, `var(--dur-base) var(--ease-spring)`
- Auto-dismiss after 4s (longer for errors)
- `prefers-reduced-motion`: opacity fade only, no slide

#### Briefing Zone
- Separated from report card by 32px gap + a 1px separator with `radial-gradient(ellipse at 50%, rgba(99,60,255,0.3), transparent 70%)` glow effect
- Panel bg slightly darker than report card: `rgba(6,9,20,0.70)`, border `--border-subtle`
- Icon: 40×40 rounded-2xl bg `rgba(99,60,255,0.20)`, border `1px solid rgba(99,60,255,0.30)`, ☀️ or ⚡ glyph, centered

### 3.5 Motion — Microinteractions

- Page mount: sections fade-up sequentially (stagger 60ms per section), `var(--dur-slow) var(--ease-smooth)`
- Tab switch: content cross-fades (`var(--dur-fast)`), report card re-enters with translateY(6px) → 0 (`var(--dur-base)`)
- Active tab pill: translate + width morph, `var(--dur-base) var(--ease-spring)`
- Section item hover: left dot scales 1 → 1.5, row bg lightens by +4% (`var(--dur-fast)`)
- Button hover: glow intensifies via `box-shadow` transition, `var(--dur-fast) var(--ease-smooth)`
- Skeleton → content: cross-fade `var(--dur-slow) var(--ease-smooth)`

Reduced-motion fallback (all):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 3.6 Accessibility

- Contrast targets: body text rgba(200,210,255,0.85) on `--color-hull` → ratio ≥ 6.5:1. Section items ≥ 4.5:1. Section headings (large) ≥ 3:1.
- Focus rings: visible on all interactive elements (buttons, tabs, links). Style: `outline: none; box-shadow: var(--focus-ring)`. Never suppressed.
- Tab bar: `role="tablist"`, each tab `role="tab"` with `aria-selected`, panel `role="tabpanel"` with `aria-labelledby`.
- Report sections: use `<section>` with `aria-label` matching the heading text.
- Status colors: never the only signal — always paired with a text label or icon. Blocked items have `aria-label="blocked"` on the status dot.
- Reduced motion: all transitions have instant fallback. Skeleton shimmer is disabled.
- Keyboard navigation: tabs navigable with arrow keys (roving tabindex pattern). Escape collapses any open overlay.

---

## 4. Component Audit Table

| Component | Current role | Redesign treatment |
|---|---|---|
| Page header `<h1>` | Text title only | Large 800-weight Inter, gradient clip on "Reports", subtitle below, freshness badge right-aligned |
| Tab bar | Pill group, slate toggle | Glass pill container, sliding glow-gradient active indicator, spring transition, tablist ARIA |
| Report card `<Card>` | Bordered slate-800 box | Glassmorphism panel — blurred, conic border, layered shadow, star-field noise overlay |
| Section heading (BEHIND etc.) | Tiny all-caps slate-500 | Colored 10px label with semantic left border + matching glow, role tied to status |
| Section items `<li>` | Disc bullet, flat text | Semantic color dot, monospace metrics, hover row highlight |
| Freshness timestamp | Tiny hidden below summary | Monospace badge top-right, color-coded by age, surfaced as trust signal |
| Briefing zone `<Card>` | Same card as report | Visually separated zone: darker panel, divider glow, icon mark |
| Loading state | Plain text "Loading…" | Shimmer skeleton bones matching section layout |
| Notifications status `<p>` | Inline text below buttons | Fixed bottom toast, glass panel, semantic border color, auto-dismiss |
| Buttons | Plain rounded-md color fills | Gradient primary with glow, glass secondary with tinted border, spring active scale |

---

## 5. Implementation Notes — Next.js + Tailwind (React + Vite applies equally)

### Token Mapping Approach

Define all CSS variables in `src/index.css` inside `:root {}`. Map to Tailwind via `tailwind.config.js`:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        void:        'var(--color-void)',
        space:       'var(--color-space)',
        hull:        'var(--color-hull)',
        'signal-ok':   'var(--color-signal-ok)',
        'signal-warn': 'var(--color-signal-warn)',
        'signal-crit': 'var(--color-signal-crit)',
        'signal-idle': 'var(--color-signal-idle)',
      },
      fontFamily: {
        sans:  ['Inter var', 'ui-sans-serif'],
        mono:  ['JetBrains Mono', 'ui-monospace'],
      },
      backdropBlur: {
        glass: '24px',
      },
      boxShadow: {
        'glow-ok':   '0 0 16px rgba(0, 229, 160, 0.35)',
        'glow-warn': '0 0 16px rgba(245, 166, 35, 0.35)',
        'glow-crit': '0 0 16px rgba(255, 75, 110, 0.35)',
        'glow-ui':   '0 0 20px rgba(99, 60, 255, 0.25)',
        glass:       'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px rgba(0,0,0,0.4)',
      },
      animation: {
        shimmer:   'shimmer 1.4s ease-in-out infinite',
        'fade-up': 'fade-up 380ms cubic-bezier(0.4,0,0.2,1) both',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'fade-up': {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [
    // scrollbar-none already present
    require('./tailwind-scrollbar-none'),
  ],
};
```

### Componentization Checklist

- `<CosmosBackground />` — star-field + nebula radial gradients, position fixed, z-0, pointer-events-none
- `<GlassPanel />` — base card primitive with blur, border, shadow; replaces `<Card />`
- `<SlidingTabBar tabs={[]} active={} onChange={} />` — tablist with spring-animated pill
- `<ReportSection heading="" semantic="ok|warn|crit|idle" items={[]} />` — colored left border, semantic dots
- `<MetricSpan value="" />` — monospace span, color-coded by threshold
- `<FreshnessBadge generatedAt="" />` — monospace, color-coded by age, `<time>` element
- `<SkeletonReport />` — shimmer bones, rendered while `report === null`
- `<BriefingZone />` — separated below-fold panel, icon, copy, 2 buttons
- `<CosmosToast message="" status="ok|warn|crit" />` — fixed bottom toast, spring slide-up

### Loading Font

Add `Inter` variable font from Bunny Fonts (GDPR-friendly) or self-host via `@fontsource/inter`. Add `JetBrains Mono` for metrics:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600&display=swap" rel="stylesheet" />
```

---

## 6. Scope Boundary

This spec covers visual and interaction redesign of the Reports page only. The following are explicitly out of scope:
- New data sources, chart types, or aggregation logic
- Date-range pickers or custom report generation
- Export / download functionality
- Backend changes
- Authentication or permission layers

Implementation of this spec is tracked on branch `cosmos/reports-redesign`.
