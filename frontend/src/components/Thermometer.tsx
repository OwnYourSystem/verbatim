import type { SKRating } from "../types";

// ── Rating helpers (single source of truth for the 3-level scale) ─────────────
export const RATINGS: SKRating[] = ["cold", "warm", "hot"];

export function ratingColor(r: SKRating): string {
  if (r === "hot") return "#ef4444";
  if (r === "warm") return "#f59e0b";
  return "#3b82f6";
}

export function ratingLabel(r: SKRating): string {
  return r === "hot" ? "HOT" : r === "warm" ? "WARM" : "COLD";
}

export function ratingGlow(r: SKRating): string {
  if (r === "hot") return "0 0 16px 5px rgba(239,68,68,0.5)";
  if (r === "warm") return "0 0 12px 4px rgba(245,158,11,0.4)";
  return "0 0 9px 3px rgba(59,130,246,0.3)";
}

// Fill fraction of the tube for each level (cold = low, hot = full).
const FILL: Record<SKRating, number> = { cold: 0.34, warm: 0.67, hot: 1 };

const TUBE_TOP = 8;
const TUBE_H = 58;

/**
 * A single thermometer icon that shows a HOT / WARM / COLD rating.
 * When `onChange` is provided it becomes a picker: click the top third for HOT,
 * the middle for WARM, the bottom for COLD.
 */
export function Thermometer({
  rating,
  onChange,
  width = 28,
  height = 90,
}: {
  rating: SKRating;
  onChange?: (r: SKRating) => void;
  width?: number;
  height?: number;
}) {
  const color = ratingColor(rating);
  const fillH = FILL[rating] * TUBE_H;
  const gradId = `thermo-${rating}-${width}`;

  const pick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onChange) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgY = ((e.clientY - rect.top) / rect.height) * 90;
    const frac = 1 - Math.max(0, Math.min(1, (svgY - TUBE_TOP) / TUBE_H));
    onChange(frac >= 0.66 ? "hot" : frac >= 0.33 ? "warm" : "cold");
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 28 90"
      xmlns="http://www.w3.org/2000/svg"
      style={{ cursor: onChange ? "pointer" : "default", userSelect: "none" }}
      onClick={pick}
      role={onChange ? "slider" : "img"}
      aria-label={`Rating: ${ratingLabel(rating)}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      {/* Hit area so clicks register across the whole tube */}
      {onChange && <rect x="2" y={TUBE_TOP} width="24" height={TUBE_H} fill="transparent" />}
      {/* Tube outline */}
      <rect
        x="9"
        y={TUBE_TOP}
        width="10"
        height={TUBE_H}
        rx="5"
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />
      {/* Mercury fill */}
      <rect
        x="9"
        y={TUBE_TOP + TUBE_H - fillH}
        width="10"
        height={fillH + 10}
        rx="5"
        fill={`url(#${gradId})`}
        style={{ transition: "all 0.25s ease" }}
      />
      {/* Bulb */}
      <circle cx="14" cy="76" r="9" fill={color} style={{ transition: "fill 0.25s ease" }} />
      <circle cx="14" cy="76" r="5" fill="rgba(255,255,255,0.2)" />
      {/* Zone ticks: HOT (top), WARM (mid), COLD (bottom) */}
      {[1, 0.66, 0.33].map((p) => (
        <line
          key={p}
          x1="19"
          y1={TUBE_TOP + (1 - p) * TUBE_H}
          x2="22"
          y2={TUBE_TOP + (1 - p) * TUBE_H}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

/** Small coloured pill showing the rating word. */
export function RatingBadge({ rating }: { rating: SKRating }) {
  const color = ratingColor(rating);
  return (
    <span
      className="text-[11px] font-bold px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}18`, border: `1px solid ${color}44` }}
    >
      {ratingLabel(rating)}
    </span>
  );
}
