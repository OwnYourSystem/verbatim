import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Report } from "../types";
import { ChartView } from "../components/Charts";

type Kind = "weekly" | "monthly" | "on-demand";
type Semantic = "ok" | "warn" | "crit" | "idle";

const SEMANTIC_BY_HEADING: Record<string, Semantic> = {
  behind: "crit",
  "coming up": "warn",
  completion: "ok",
};

const SEMANTIC_STYLES: Record<Semantic, { color: string; border: string; glow: string }> = {
  ok: { color: "var(--color-signal-ok)", border: "rgba(0,229,160,0.4)", glow: "var(--glow-ok)" },
  warn: { color: "var(--color-signal-warn)", border: "rgba(245,166,35,0.4)", glow: "var(--glow-warn)" },
  crit: { color: "var(--color-signal-crit)", border: "rgba(255,75,110,0.4)", glow: "var(--glow-crit)" },
  idle: { color: "var(--color-signal-idle)", border: "rgba(107,130,181,0.4)", glow: "none" },
};

function semanticFor(heading: string): Semantic {
  return SEMANTIC_BY_HEADING[heading.toLowerCase().trim()] ?? "idle";
}

function FreshnessBadge({ generatedAt }: { generatedAt: string }) {
  const age = Date.now() - new Date(generatedAt).getTime();
  const fresh = age >= 0 && age < 60 * 60 * 1000;
  const color = Number.isNaN(age)
    ? "var(--color-signal-idle)"
    : fresh
      ? "var(--color-signal-ok)"
      : "var(--color-signal-warn)";
  return (
    <time
      dateTime={generatedAt}
      className="metric text-[11px] px-2.5 py-1 rounded-full"
      style={{ color, border: `1px solid ${color}`, background: "rgba(8,12,24,0.6)" }}
      title="Report generated at"
    >
      ⏱ {generatedAt.replace("T", " ").slice(0, 16)}
    </time>
  );
}

function ReportSection({ heading, items }: { heading: string; items: string[] }) {
  const s = SEMANTIC_STYLES[semanticFor(heading)];
  return (
    <section
      aria-label={heading}
      className="rounded-2xl p-4"
      style={{
        background: "rgba(8,12,24,0.6)",
        border: "1px solid rgba(120,140,220,0.12)",
        borderLeft: `2px solid ${s.border}`,
      }}
    >
      <h3
        className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-3"
        style={{ color: s.color, textShadow: s.glow === "none" ? undefined : s.glow }}
      >
        {heading}
      </h3>
      <ul className="space-y-2 text-sm" style={{ color: "rgba(200,210,255,0.85)" }}>
        {items.map((item, j) => (
          <li key={j} className="flex gap-2.5 items-start group rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.04]">
            <span
              aria-hidden
              className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 transition-transform group-hover:scale-150"
              style={{ background: s.color }}
            />
            <MetricText text={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Render percentages in the item with monospace + threshold color. */
function MetricText({ text }: { text: string }) {
  const parts = text.split(/(\d+%)/g);
  return (
    <span>
      {parts.map((p, i) => {
        const m = p.match(/^(\d+)%$/);
        if (!m) return <span key={i}>{p}</span>;
        const v = Number(m[1]);
        const color =
          v >= 80 ? "var(--color-signal-ok)" : v >= 40 ? "var(--color-signal-warn)" : "var(--color-signal-crit)";
        return (
          <span key={i} className="metric" style={{ color }}>
            {p}
          </span>
        );
      })}
    </span>
  );
}

function SkeletonReport() {
  return (
    <div className="glass-panel p-6 space-y-4" aria-busy="true" aria-label="Loading report">
      <div className="skeleton-bone h-6 w-48" />
      <div className="skeleton-bone h-4 w-72" />
      <div className="grid md:grid-cols-2 gap-4 pt-2">
        <div className="skeleton-bone h-28" />
        <div className="skeleton-bone h-28" />
        <div className="skeleton-bone h-28 md:col-span-2" />
      </div>
    </div>
  );
}

/** KPI stat strip — derived from the report sections we actually have (no fake data). */
function StatStrip({ report }: { report: Report }) {
  const find = (h: string) =>
    report.sections.find((s) => s.heading.toLowerCase().trim() === h);
  const behind = find("behind")?.items.length ?? 0;
  const coming = find("coming up")?.items.length ?? 0;
  const completionItems = find("completion")?.items ?? [];
  const pcts = completionItems
    .map((i) => i.match(/(\d+)%/)?.[1])
    .filter(Boolean)
    .map(Number);
  const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;

  const stats: { label: string; value: string; unit: string; semantic: Semantic }[] = [
    { label: "Behind", value: String(behind), unit: behind === 1 ? "item" : "items", semantic: behind > 0 ? "crit" : "ok" },
    { label: "Coming up", value: String(coming), unit: coming === 1 ? "deadline" : "deadlines", semantic: coming > 0 ? "warn" : "idle" },
    {
      label: "Avg completion",
      value: avg != null ? String(avg) : "—",
      unit: avg != null ? "%" : "",
      semantic: avg == null ? "idle" : avg >= 80 ? "ok" : avg >= 40 ? "warn" : "crit",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4 animate-fade-up">
      {stats.map((st) => {
        const s = SEMANTIC_STYLES[st.semantic];
        return (
          <div
            key={st.label}
            className="rounded-2xl p-4"
            style={{ background: "rgba(8,12,24,0.6)", border: "1px solid rgba(120,140,220,0.12)" }}
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--color-signal-idle)" }}>
              {st.label}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="metric text-3xl md:text-4xl" style={{ color: s.color }}>
                {st.value}
              </span>
              {st.unit && (
                <span className="metric text-xs" style={{ color: "rgba(200,210,255,0.5)" }}>
                  {st.unit}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TABS: Kind[] = ["weekly", "monthly", "on-demand"];

function SlidingTabBar({ active, onChange }: { active: Kind; onChange: (k: Kind) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = refs.current[TABS.indexOf(active)];
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);

  return (
    <div
      role="tablist"
      aria-label="Report period"
      className="relative flex gap-1 p-1 rounded-2xl w-fit"
      style={{
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Sliding active pill */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-xl transition-all duration-200"
        style={{
          left: pill.left,
          width: pill.width,
          background: "linear-gradient(135deg, #6b21ff, #00e5a0)",
          boxShadow: "var(--glow-ui)",
          transitionTimingFunction: "var(--ease-spring)",
        }}
      />
      {TABS.map((t, i) => (
        <button
          key={t}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          aria-selected={active === t}
          onClick={() => onChange(t)}
          className={`relative z-10 px-5 py-2 rounded-xl text-sm font-semibold capitalize transition-colors duration-200 ${
            active === t ? "text-white" : "hover:text-white"
          }`}
          style={active === t ? undefined : { color: "var(--color-signal-idle)" }}
        >
          {t.replace("-", " ")}
        </button>
      ))}
    </div>
  );
}

export function Reports() {
  const [kind, setKind] = useState<Kind>("weekly");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  useEffect(() => {
    setReport(null);
    api
      .report(kind)
      .then(setReport)
      .catch((e) => setError(String(e)));
  }, [kind]);

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setNotifStatus("This browser does not support notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifStatus(perm === "granted" ? "Notifications enabled." : `Permission: ${perm}.`);
  };

  const showBriefing = async () => {
    try {
      const briefing = await api.report("morning-briefing");
      const body = briefing.summary;
      if ("serviceWorker" in navigator && Notification.permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(briefing.title, { body });
      } else if (Notification.permission === "granted") {
        new Notification(briefing.title, { body });
      } else {
        setNotifStatus("Enable notifications first.");
      }
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="text-gradient">Reports</span>
          </h1>
          <p className="mt-1.5 text-sm text-ink-soft dark:text-slate-400">
            How each system is moving — behind, on track, or done.
          </p>
        </div>
        {report && <FreshnessBadge generatedAt={report.generated_at} />}
      </div>

      {error && <p className="text-amber-400 text-sm">{error}</p>}

      <SlidingTabBar active={kind} onChange={setKind} />

      {report && <StatStrip report={report} />}

      {report ? (
        <div className="glass-panel p-6 animate-fade-up" role="tabpanel">
          <h2 className="text-lg font-bold">{report.title}</h2>
          <p className="mt-1 text-base italic" style={{ color: "rgba(210,220,255,0.75)" }}>
            {report.summary}
          </p>
          {report.charts.length > 0 && (
            <div className="mt-6 grid md:grid-cols-2 gap-4">
              {report.charts.map((c, i) => (
                <div
                  key={i}
                  className="animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <ChartView chart={c} />
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 grid md:grid-cols-2 gap-4">
            {report.sections.map((s, i) => (
              <div key={i} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <ReportSection heading={s.heading} items={s.items} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        !error && <SkeletonReport />
      )}

      {/* Glowing divider before the briefing zone */}
      <div
        aria-hidden
        className="h-px w-full"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(99,60,255,0.35), transparent 70%)",
        }}
      />

      <div
        className="animate-fade-up rounded-3xl p-6"
        style={{ background: "rgba(6,9,20,0.7)", border: "1px solid rgba(120,140,220,0.12)" }}
      >
        <div className="flex items-center gap-3 mb-3">
          <span
            aria-hidden
            className="h-10 w-10 rounded-2xl flex items-center justify-center text-lg"
            style={{ background: "rgba(99,60,255,0.2)", border: "1px solid rgba(99,60,255,0.3)" }}
          >
            ☀️
          </span>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft dark:text-slate-500">
            Morning briefing & notifications
          </h2>
        </div>
        <p className="text-sm text-ink-soft dark:text-slate-400 mb-4">
          Enable browser notifications, then preview today's briefing. (Scheduled server push is a
          deploy-time feature — see docs/NOTIFICATIONS.md.)
        </p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={enableNotifications} className="cosmos-btn-secondary">
            Enable notifications
          </button>
          <button onClick={showBriefing} className="cosmos-btn-primary">
            Show briefing now
          </button>
        </div>
        {notifStatus && <p className="text-sm text-ink-soft dark:text-slate-400 mt-3">{notifStatus}</p>}
      </div>
    </div>
  );
}
