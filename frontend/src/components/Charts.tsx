import type { Chart, ChartPoint } from "../types";

const UI = "#7c3aed";
const TRACK = "rgba(120,140,220,0.12)";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Horizontal bar chart. Supports an optional secondary value (e.g. spent vs budget). */
function BarChart({ chart }: { chart: Chart }) {
  const max = Math.max(1, ...chart.points.flatMap((p) => [p.value, p.secondary ?? 0]));
  return (
    <div className="space-y-2.5">
      {chart.points.map((p, i) => (
        <div key={i}>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-slate-300">{p.label}</span>
            <span className="metric text-slate-400">
              {fmt(p.value)}
              {chart.unit}
              {p.secondary != null && (
                <span className="text-slate-500">
                  {" "}
                  · {fmt(p.secondary)}
                  {chart.unit} spent
                </span>
              )}
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden relative" style={{ background: TRACK }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(p.value / max) * 100}%`, background: p.color ?? UI }}
            />
            {p.secondary != null && (
              <div
                className="absolute top-0 h-full rounded-full opacity-90"
                style={{
                  width: `${(p.secondary / max) * 100}%`,
                  background: "rgba(255,255,255,0.35)",
                }}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut pie chart via stroke-dasharray arcs. */
function PieChart({ chart }: { chart: Chart }) {
  const total = chart.points.reduce((a, p) => a + Math.max(0, p.value), 0);
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const palette = ["#00e5a0", "#7c3aed", "#6b82b5", "#ff4b6e", "#f5a623"];

  return (
    <div className="flex items-center gap-5">
      <svg width="150" height="150" viewBox="0 0 150 150" className="shrink-0">
        <circle cx="75" cy="75" r={R} fill="none" stroke={TRACK} strokeWidth="18" />
        {total > 0 &&
          chart.points.map((p, i) => {
            const frac = Math.max(0, p.value) / total;
            const dash = frac * C;
            const el = (
              <circle
                key={i}
                cx="75"
                cy="75"
                r={R}
                fill="none"
                stroke={p.color ?? palette[i % palette.length]}
                strokeWidth="18"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 75 75)"
              />
            );
            offset += dash;
            return el;
          })}
        <text x="75" y="80" textAnchor="middle" className="metric" fill="#c8d2ff" fontSize="20">
          {fmt(total)}
        </text>
      </svg>
      <ul className="space-y-1.5 text-xs">
        {chart.points.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: p.color ?? palette[i % palette.length] }}
            />
            <span className="text-slate-300">{p.label}</span>
            <span className="metric text-slate-500">{fmt(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Waterfall: running cumulative total with floating bars (budget → spent → remaining). */
function WaterfallChart({ chart }: { chart: Chart }) {
  // Compute cumulative baseline for each step.
  let running = 0;
  const steps = chart.points.map((p) => {
    const start = running;
    running += p.value;
    return { ...p, start, end: running };
  });
  const max = Math.max(1, ...steps.map((s) => Math.max(s.start, s.end)));
  const H = 140;
  const colW = 100 / chart.points.length;

  return (
    <svg width="100%" height={H + 28} viewBox={`0 0 100 ${H + 28}`} preserveAspectRatio="none">
      {steps.map((s, i) => {
        const top = H - (Math.max(s.start, s.end) / max) * H;
        const barH = (Math.abs(s.value) / max) * H;
        const x = i * colW + colW * 0.2;
        const w = colW * 0.6;
        return (
          <g key={i}>
            <rect x={x} y={top} width={w} height={Math.max(barH, 1)} rx="1.5" fill={s.color ?? UI} />
            <text
              x={x + w / 2}
              y={top - 3}
              textAnchor="middle"
              fontSize="5"
              className="metric"
              fill="#c8d2ff"
            >
              {fmt(Math.abs(s.value))}
            </text>
            <text
              x={x + w / 2}
              y={H + 12}
              textAnchor="middle"
              fontSize="4.5"
              fill="#6b82b5"
            >
              {s.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function ChartFrame({ chart, children }: { chart: Chart; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "rgba(8,12,24,0.6)", border: "1px solid rgba(120,140,220,0.12)" }}
    >
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 mb-3">
        {chart.title}
        {chart.unit ? ` (${chart.unit})` : ""}
      </h3>
      {children}
    </div>
  );
}

export function ChartView({ chart }: { chart: Chart }) {
  const empty = chart.points.every((p: ChartPoint) => !p.value && !p.secondary);
  if (empty) {
    return (
      <ChartFrame chart={chart}>
        <p className="text-xs text-slate-500">No data yet.</p>
      </ChartFrame>
    );
  }
  return (
    <ChartFrame chart={chart}>
      {chart.type === "bar" && <BarChart chart={chart} />}
      {chart.type === "pie" && <PieChart chart={chart} />}
      {(chart.type === "waterfall" || chart.type === "line") && <WaterfallChart chart={chart} />}
    </ChartFrame>
  );
}
