import type { ReactNode } from "react";
import { ME_BORDER, ME_INK, ME_TEAL } from "./tokens";

export function ProgressRing({
  value,
  size = 64,
  strokeWidth = 7,
  color = ME_TEAL,
  trackColor = ME_BORDER,
  label,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      {label && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-extrabold" style={{ color: ME_INK }}>
          {label}
        </div>
      )}
    </div>
  );
}
