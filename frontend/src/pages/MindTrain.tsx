import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import { api } from "../api";
import type { System } from "../types";

// ── Colour palette for wagons (cycles by index) ──────────────────────────────
const WAGON_COLORS = [
  { body: "#c0392b", roof: "#922b21", stripe: "#e74c3c" },
  { body: "#d35400", roof: "#a04000", stripe: "#e67e22" },
  { body: "#b7950b", roof: "#9a7d0a", stripe: "#f1c40f" },
  { body: "#1e8449", roof: "#196f3d", stripe: "#27ae60" },
  { body: "#1a5276", roof: "#154360", stripe: "#2980b9" },
  { body: "#6c3483", roof: "#5b2c6f", stripe: "#8e44ad" },
  { body: "#117a65", roof: "#0e6655", stripe: "#1abc9c" },
  { body: "#784212", roof: "#6e2f12", stripe: "#a04000" },
];
const wc = (i: number) => WAGON_COLORS[i % WAGON_COLORS.length];

// ── SVG: Locomotive ──────────────────────────────────────────────────────────
function LocomotiveSVG() {
  return (
    <svg width="200" height="130" viewBox="0 0 200 130" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="boilerGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a4a4a" />
          <stop offset="100%" stopColor="#222" />
        </linearGradient>
        <linearGradient id="cabGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#555" />
          <stop offset="100%" stopColor="#2a2a2a" />
        </linearGradient>
        <radialGradient id="wheelGrad" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#666" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </radialGradient>
        <filter id="locoShadow">
          <feDropShadow dx="3" dy="3" stdDeviation="3" floodOpacity="0.5" />
        </filter>
      </defs>

      {/* Smoke */}
      <ellipse cx="28" cy="12" rx="7" ry="5" fill="rgba(200,200,200,0.4)" />
      <ellipse cx="36" cy="6" rx="5" ry="4" fill="rgba(200,200,200,0.3)" />
      <ellipse cx="20" cy="8" rx="4" ry="3" fill="rgba(200,200,200,0.2)" />

      {/* Chimney */}
      <rect x="20" y="18" width="14" height="22" rx="2" fill="#333" />
      <rect x="17" y="17" width="20" height="5" rx="2" fill="#444" />

      {/* Boiler */}
      <rect x="10" y="38" width="120" height="45" rx="12" fill="url(#boilerGrad)" filter="url(#locoShadow)" />
      {/* Boiler highlight */}
      <rect x="12" y="40" width="116" height="8" rx="8" fill="rgba(255,255,255,0.06)" />
      {/* Boiler bands */}
      <rect x="40" y="38" width="3" height="45" rx="1" fill="rgba(255,255,255,0.08)" />
      <rect x="70" y="38" width="3" height="45" rx="1" fill="rgba(255,255,255,0.08)" />
      <rect x="100" y="38" width="3" height="45" rx="1" fill="rgba(255,255,255,0.08)" />

      {/* Dome */}
      <ellipse cx="85" cy="38" rx="12" ry="8" fill="#555" />
      <ellipse cx="85" cy="36" rx="10" ry="5" fill="#666" />

      {/* Cab */}
      <rect x="128" y="28" width="54" height="55" rx="4" fill="url(#cabGrad)" filter="url(#locoShadow)" />
      {/* Cab windows */}
      <rect x="134" y="34" width="18" height="14" rx="2" fill="#1a3a5c" />
      <rect x="136" y="36" width="14" height="10" rx="1" fill="#2a5a8c" opacity="0.8" />
      <rect x="158" y="34" width="18" height="14" rx="2" fill="#1a3a5c" />
      <rect x="160" y="36" width="14" height="10" rx="1" fill="#2a5a8c" opacity="0.8" />
      {/* Cab door */}
      <rect x="144" y="54" width="14" height="28" rx="2" fill="#333" />
      <circle cx="156" cy="68" r="2" fill="#c8a83a" />

      {/* "YOU" badge on cab */}
      <rect x="130" y="56" width="42" height="14" rx="3" fill="#c8a83a" opacity="0.9" />
      <text x="151" y="67" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1a1a1a">ENGINEER</text>

      {/* Running board */}
      <rect x="8" y="82" width="172" height="6" rx="2" fill="#555" />

      {/* Front beam / cowcatcher */}
      <polygon points="8,82 8,92 2,100 14,92" fill="#666" />

      {/* Coupler (right side) */}
      <rect x="178" y="92" width="16" height="6" rx="1" fill="#888" />
      <rect x="190" y="90" width="8" height="10" rx="1" fill="#666" />

      {/* Undercarriage */}
      <rect x="10" y="90" width="172" height="8" rx="2" fill="#2a2a2a" />

      {/* Large driving wheels ×2 */}
      <circle cx="55" cy="105" r="20" fill="url(#wheelGrad)" stroke="#555" strokeWidth="2" />
      <circle cx="55" cy="105" r="14" fill="none" stroke="#444" strokeWidth="1.5" />
      <circle cx="55" cy="105" r="4" fill="#888" />
      {/* Spokes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={55 + 4 * Math.cos((a * Math.PI) / 180)}
          y1={105 + 4 * Math.sin((a * Math.PI) / 180)}
          x2={55 + 18 * Math.cos((a * Math.PI) / 180)}
          y2={105 + 18 * Math.sin((a * Math.PI) / 180)}
          stroke="#555"
          strokeWidth="1.5"
        />
      ))}

      <circle cx="115" cy="105" r="20" fill="url(#wheelGrad)" stroke="#555" strokeWidth="2" />
      <circle cx="115" cy="105" r="14" fill="none" stroke="#444" strokeWidth="1.5" />
      <circle cx="115" cy="105" r="4" fill="#888" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={115 + 4 * Math.cos((a * Math.PI) / 180)}
          y1={105 + 4 * Math.sin((a * Math.PI) / 180)}
          x2={115 + 18 * Math.cos((a * Math.PI) / 180)}
          y2={105 + 18 * Math.sin((a * Math.PI) / 180)}
          stroke="#555"
          strokeWidth="1.5"
        />
      ))}

      {/* Small leading wheel */}
      <circle cx="168" cy="108" r="13" fill="url(#wheelGrad)" stroke="#555" strokeWidth="1.5" />
      <circle cx="168" cy="108" r="5" fill="#888" />

      {/* Connecting rod */}
      <rect x="54" y="102" width="62" height="5" rx="2" fill="#c8a83a" opacity="0.8" />

      {/* Headlight */}
      <circle cx="9" cy="72" r="6" fill="#f5e642" opacity="0.9" />
      <circle cx="9" cy="72" r="4" fill="white" opacity="0.8" />
    </svg>
  );
}

// ── SVG: Wagon ────────────────────────────────────────────────────────────────
function WagonSVG({ name, colorIdx }: { name: string; colorIdx: number }) {
  const c = wc(colorIdx);
  const label = name.length > 14 ? name.slice(0, 13) + "…" : name;
  return (
    <svg width="155" height="110" viewBox="0 0 155 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`wbody${colorIdx}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.body} />
          <stop offset="100%" stopColor={c.roof} />
        </linearGradient>
        <filter id={`wshadow${colorIdx}`}>
          <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.4" />
        </filter>
      </defs>

      {/* Roof */}
      <rect x="4" y="10" width="147" height="12" rx="4" fill={c.roof} filter={`url(#wshadow${colorIdx})`} />
      <rect x="2" y="8" width="151" height="6" rx="3" fill={c.stripe} opacity="0.7" />

      {/* Body */}
      <rect x="6" y="20" width="143" height="60" rx="3" fill={`url(#wbody${colorIdx})`} filter={`url(#wshadow${colorIdx})`} />
      {/* Body highlight */}
      <rect x="8" y="22" width="139" height="8" rx="2" fill="rgba(255,255,255,0.1)" />

      {/* Windows */}
      <rect x="14" y="28" width="24" height="18" rx="3" fill="#1a2a3a" />
      <rect x="16" y="30" width="20" height="14" rx="2" fill="#2a4a6a" opacity="0.85" />
      <rect x="64" y="28" width="24" height="18" rx="3" fill="#1a2a3a" />
      <rect x="66" y="30" width="20" height="14" rx="2" fill="#2a4a6a" opacity="0.85" />
      <rect x="114" y="28" width="24" height="18" rx="3" fill="#1a2a3a" />
      <rect x="116" y="30" width="20" height="14" rx="2" fill="#2a4a6a" opacity="0.85" />

      {/* Door */}
      <rect x="55" y="42" width="22" height="37" rx="2" fill={c.roof} opacity="0.9" />
      <circle cx="73" cy="61" r="2" fill="#d4af37" />
      <line x1="55" y1="51" x2="77" y2="51" stroke={c.stripe} strokeWidth="0.8" opacity="0.5" />

      {/* Stripe band */}
      <rect x="6" y="57" width="143" height="5" rx="1" fill={c.stripe} opacity="0.35" />

      {/* System name */}
      <rect x="6" y="64" width="143" height="16" rx="2" fill="rgba(0,0,0,0.25)" />
      <text x="77" y="76" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white" opacity="0.95">{label}</text>

      {/* Left coupler */}
      <rect x="0" y="66" width="8" height="5" rx="1" fill="#888" />
      {/* Right coupler */}
      <rect x="147" y="66" width="8" height="5" rx="1" fill="#888" />

      {/* Undercarriage */}
      <rect x="8" y="80" width="139" height="7" rx="2" fill="#2a2a2a" />

      {/* Bogies (wheel assemblies) */}
      {/* Left bogie */}
      <rect x="16" y="85" width="38" height="6" rx="2" fill="#333" />
      <circle cx="26" cy="97" r="9" fill="#222" stroke="#444" strokeWidth="1.5" />
      <circle cx="26" cy="97" r="5" fill="none" stroke="#555" strokeWidth="1" />
      <circle cx="26" cy="97" r="2" fill="#666" />
      <circle cx="44" cy="97" r="9" fill="#222" stroke="#444" strokeWidth="1.5" />
      <circle cx="44" cy="97" r="5" fill="none" stroke="#555" strokeWidth="1" />
      <circle cx="44" cy="97" r="2" fill="#666" />

      {/* Right bogie */}
      <rect x="101" y="85" width="38" height="6" rx="2" fill="#333" />
      <circle cx="111" cy="97" r="9" fill="#222" stroke="#444" strokeWidth="1.5" />
      <circle cx="111" cy="97" r="5" fill="none" stroke="#555" strokeWidth="1" />
      <circle cx="111" cy="97" r="2" fill="#666" />
      <circle cx="129" cy="97" r="9" fill="#222" stroke="#444" strokeWidth="1.5" />
      <circle cx="129" cy="97" r="5" fill="none" stroke="#555" strokeWidth="1" />
      <circle cx="129" cy="97" r="2" fill="#666" />
    </svg>
  );
}

// ── SVG: Castle ───────────────────────────────────────────────────────────────
function CastleSVG({
  goals,
  onChange,
}: {
  goals: [string, string, string];
  onChange: (i: 0 | 1 | 2, v: string) => void;
}) {
  return (
    <div className="relative select-none" style={{ width: 240, flexShrink: 0 }}>
      <svg width="240" height="220" viewBox="0 0 240 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="stoneGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7f8c8d" />
            <stop offset="100%" stopColor="#4a4f52" />
          </linearGradient>
          <linearGradient id="towerGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#95a5a6" />
            <stop offset="100%" stopColor="#5a6164" />
          </linearGradient>
          <pattern id="stone" width="18" height="12" patternUnits="userSpaceOnUse">
            <rect width="18" height="12" fill="none" />
            <rect x="0" y="0" width="8" height="5" rx="0.5" fill="rgba(255,255,255,0.06)" />
            <rect x="10" y="6" width="8" height="5" rx="0.5" fill="rgba(255,255,255,0.06)" />
          </pattern>
          <filter id="castleShadow">
            <feDropShadow dx="4" dy="4" stdDeviation="4" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Left tower */}
        <rect x="8" y="30" width="60" height="155" rx="3" fill="url(#towerGrad)" filter="url(#castleShadow)" />
        <rect x="8" y="30" width="60" height="155" fill="url(#stone)" opacity="0.6" />
        {/* Left battlements */}
        {[8, 22, 36, 50].map((x) => (
          <rect key={x} x={x} y="18" width="10" height="14" rx="1" fill="url(#towerGrad)" />
        ))}
        {/* Left tower window */}
        <rect x="26" y="50" width="22" height="28" rx="10" fill="#1a2a3a" />
        <rect x="28" y="52" width="18" height="24" rx="9" fill="#2a4060" opacity="0.7" />
        {/* Left flag */}
        <line x1="38" y1="0" x2="38" y2="20" stroke="#8b7355" strokeWidth="2" />
        <polygon points="38,0 58,8 38,16" fill="#e74c3c" />

        {/* Right tower */}
        <rect x="172" y="30" width="60" height="155" rx="3" fill="url(#towerGrad)" filter="url(#castleShadow)" />
        <rect x="172" y="30" width="60" height="155" fill="url(#stone)" opacity="0.6" />
        {[172, 186, 200, 214].map((x) => (
          <rect key={x} x={x} y="18" width="10" height="14" rx="1" fill="url(#towerGrad)" />
        ))}
        <rect x="190" y="50" width="22" height="28" rx="10" fill="#1a2a3a" />
        <rect x="192" y="52" width="18" height="24" rx="9" fill="#2a4060" opacity="0.7" />
        <line x1="202" y1="0" x2="202" y2="20" stroke="#8b7355" strokeWidth="2" />
        <polygon points="202,0 222,8 202,16" fill="#27ae60" />

        {/* Centre wall */}
        <rect x="60" y="60" width="120" height="125" rx="2" fill="url(#stoneGrad)" filter="url(#castleShadow)" />
        <rect x="60" y="60" width="120" height="125" fill="url(#stone)" opacity="0.5" />
        {/* Centre battlements */}
        {[60, 76, 92, 108, 124, 140, 156].map((x) => (
          <rect key={x} x={x} y="48" width="10" height="14" rx="1" fill="url(#stoneGrad)" />
        ))}

        {/* Gate arch */}
        <path d="M85,185 L85,130 Q120,105 155,130 L155,185 Z" fill="#1a1a1a" />
        <path d="M88,185 L88,132 Q120,110 152,132 L152,185 Z" fill="#0d1520" />
        {/* Portcullis bars */}
        {[96, 108, 120, 132, 144].map((x) => (
          <line key={x} x1={x} y1="115" x2={x} y2="185" stroke="#444" strokeWidth="1.5" />
        ))}
        {[120, 135, 150, 165, 180].map((y) => (
          <line key={y} x1="88" y1={y} x2="152" y2={y} stroke="#444" strokeWidth="1.5" />
        ))}

        {/* Draw the track rails entering the gate */}
        <rect x="105" y="195" width="6" height="25" rx="1" fill="#8b7355" />
        <rect x="129" y="195" width="6" height="25" rx="1" fill="#8b7355" />
        {[198, 207, 216].map((y) => (
          <rect key={y} x="103" y={y} width="34" height="3" rx="0.5" fill="#5a4030" />
        ))}

        {/* "DESTINATION" label */}
        <rect x="68" y="64" width="104" height="14" rx="2" fill="rgba(0,0,0,0.4)" />
        <text x="120" y="75" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#f1c40f" letterSpacing="1">
          DESTINATION
        </text>
      </svg>

      {/* Goal input fields — absolutely positioned over the centre wall */}
      <div className="absolute" style={{ top: 88, left: 64, width: 112 }}>
        {(["I", "II", "III"] as const).map((num, i) => (
          <div key={i} className="mb-1">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[8px] font-black text-amber-400">{num}</span>
            </div>
            <input
              type="text"
              value={goals[i as 0 | 1 | 2]}
              onChange={(e) => onChange(i as 0 | 1 | 2, e.target.value)}
              placeholder={`Goal ${i + 1}…`}
              className="w-full text-[9px] px-1.5 py-1 rounded bg-black/50 border border-amber-700/40 text-amber-100 placeholder-amber-900/60 focus:outline-none focus:border-amber-400/60"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SVG: Track segment (fills gap between items) ─────────────────────────────
function TrackFill({ width }: { width: number }) {
  if (width <= 0) return null;
  return (
    <svg width={width} height="30" viewBox={`0 0 ${width} 30`} fill="none">
      <rect x="0" y="4" width={width} height="5" rx="1" fill="#8b7355" />
      <rect x="0" y="21" width={width} height="5" rx="1" fill="#8b7355" />
      {Array.from({ length: Math.floor(width / 18) + 1 }, (_, k) => (
        <rect key={k} x={k * 18} y="2" width="10" height="26" rx="1" fill="#5a4030" opacity="0.7" />
      ))}
    </svg>
  );
}

// ── Coupling SVG ──────────────────────────────────────────────────────────────
function Coupling() {
  return (
    <svg width="16" height="20" viewBox="0 0 16 20">
      <rect x="3" y="7" width="10" height="6" rx="2" fill="#aaa" />
      <rect x="6" y="3" width="4" height="14" rx="1" fill="#888" />
    </svg>
  );
}

// ── Scrollable background scene ───────────────────────────────────────────────
function SceneBackground({ width }: { width: number }) {
  const w = Math.max(width, 900);
  const h = 440;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d1b2a" />
          <stop offset="50%" stopColor="#1a3a5c" />
          <stop offset="100%" stopColor="#2c5f8a" />
        </linearGradient>
        <linearGradient id="farHill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a3a28" />
          <stop offset="100%" stopColor="#0d2018" />
        </linearGradient>
        <linearGradient id="nearHill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e5c30" />
          <stop offset="100%" stopColor="#0f3018" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a4020" />
          <stop offset="100%" stopColor="#0d2010" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="85%" cy="12%" r="18%">
          <stop offset="0%" stopColor="#ffe08a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect width={w} height={h} fill="url(#sky)" />
      {/* Sun glow */}
      <rect width={w} height={h} fill="url(#sunGlow)" />
      {/* Sun */}
      <circle cx={w * 0.85} cy={55} r={32} fill="#ffe566" opacity="0.85" />
      <circle cx={w * 0.85} cy={55} r={22} fill="#fff0a0" opacity="0.9" />
      {/* Sun rays */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
        <line
          key={deg}
          x1={w * 0.85 + 34 * Math.cos((deg * Math.PI) / 180)}
          y1={55 + 34 * Math.sin((deg * Math.PI) / 180)}
          x2={w * 0.85 + 48 * Math.cos((deg * Math.PI) / 180)}
          y2={55 + 48 * Math.sin((deg * Math.PI) / 180)}
          stroke="#ffe566"
          strokeWidth="2"
          opacity="0.6"
        />
      ))}

      {/* Stars */}
      {[20, 80, 150, 240, 310, 400, 500, 600, 700, 800].map((x) => (
        <circle key={x} cx={x} cy={20 + (x % 40)} r="1.2" fill="white" opacity="0.6" />
      ))}

      {/* Clouds */}
      {[w * 0.1, w * 0.35, w * 0.6].map((cx, i) => (
        <g key={i} opacity="0.55">
          <ellipse cx={cx} cy={80 + i * 15} rx={60} ry={18} fill="white" />
          <ellipse cx={cx - 25} cy={88 + i * 15} rx={35} ry={14} fill="white" />
          <ellipse cx={cx + 30} cy={85 + i * 15} rx={40} ry={16} fill="white" />
        </g>
      ))}

      {/* Far hills */}
      <path
        d={`M0,${h * 0.52} Q${w * 0.15},${h * 0.3} ${w * 0.3},${h * 0.48} Q${w * 0.45},${h * 0.28} ${w * 0.6},${h * 0.5} Q${w * 0.75},${h * 0.32} ${w * 0.9},${h * 0.46} L${w},${h * 0.5} L${w},${h} L0,${h} Z`}
        fill="url(#farHill)"
        opacity="0.8"
      />

      {/* Near hills */}
      <path
        d={`M0,${h * 0.65} Q${w * 0.1},${h * 0.48} ${w * 0.22},${h * 0.6} Q${w * 0.35},${h * 0.42} ${w * 0.48},${h * 0.62} Q${w * 0.62},${h * 0.44} ${w * 0.76},${h * 0.58} Q${w * 0.88},${h * 0.46} ${w},${h * 0.6} L${w},${h} L0,${h} Z`}
        fill="url(#nearHill)"
      />

      {/* Ground strip */}
      <rect x={0} y={h * 0.76} width={w} height={h * 0.24} fill="url(#ground)" />

      {/* Trees */}
      {[w * 0.05, w * 0.18, w * 0.32, w * 0.52, w * 0.67, w * 0.82].map((tx, i) => {
        const th = 50 + (i % 3) * 15;
        const ty = h * 0.62 - th;
        return (
          <g key={i}>
            <rect x={tx - 4} y={ty + th * 0.55} width={8} height={th * 0.45} rx="2" fill="#5a3820" />
            <ellipse cx={tx} cy={ty + th * 0.4} rx={18 + (i % 2) * 5} ry={th * 0.5} fill="#1a5c28" />
            <ellipse cx={tx} cy={ty + th * 0.25} rx={13} ry={th * 0.35} fill="#227a35" />
          </g>
        );
      })}

      {/* Track bed (gravel) */}
      <rect x={0} y={h * 0.76} width={w} height={16} fill="#4a3828" />

      {/* Track rails */}
      <rect x={0} y={h * 0.76 + 2} width={w} height={5} rx="1" fill="#9a8060" />
      <rect x={0} y={h * 0.76 + 10} width={w} height={5} rx="1" fill="#9a8060" />
      {/* Track ties */}
      {Array.from({ length: Math.ceil(w / 28) }, (_, k) => (
        <rect key={k} x={k * 28} y={h * 0.76} width={16} height={16} rx="1" fill="#6b4c30" opacity="0.8" />
      ))}
    </svg>
  );
}

// ── Draggable wagon on the track ──────────────────────────────────────────────
function SortableWagon({
  systemId,
  name,
  colorIdx,
}: {
  systemId: number;
  name: string;
  colorIdx: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: systemId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    cursor: "grab",
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="flex items-end">
      <Coupling />
      <WagonSVG name={name} colorIdx={colorIdx} />
    </div>
  );
}

// ── Depot sidebar item ────────────────────────────────────────────────────────
function DepotItem({ system, colorIdx }: { system: System; colorIdx: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: system.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: "grab",
    touchAction: "none",
  };

  const c = wc(colorIdx);
  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeft: `4px solid ${c.stripe}` }}
      {...attributes}
      {...listeners}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-sm font-semibold text-slate-200 select-none hover:bg-slate-700/80 transition-colors"
    >
      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.stripe }} />
      <span className="flex-1 truncate text-xs">{system.name}</span>
      <span className="text-slate-500 text-[10px]">drag →</span>
    </div>
  );
}

// ── Main MindTrain page ───────────────────────────────────────────────────────
export function MindTrain() {
  const [systems, setSystems] = useState<System[]>([]);
  const [wagonOrder, setWagonOrder] = useState<number[]>([]);
  const [goals, setGoals] = useState<[string, string, string]>(["", "", ""]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [activeSource, setActiveSource] = useState<"depot" | "train" | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sceneRef = useRef<HTMLDivElement>(null);

  // ── Load data ──
  useEffect(() => {
    api.listSystems().then(setSystems).catch(console.error);
    api
      .getTrainConfig()
      .then((cfg) => {
        setWagonOrder(cfg.wagon_order);
        setGoals([cfg.goal_1 ?? "", cfg.goal_2 ?? "", cfg.goal_3 ?? ""]);
      })
      .catch(console.error);
  }, []);

  // ── Remove deleted systems from wagon order ──
  useEffect(() => {
    const ids = new Set(systems.map((s) => s.id));
    setWagonOrder((prev) => prev.filter((id) => ids.has(id)));
  }, [systems]);

  // ── Debounced save ──
  const scheduleSave = useCallback(
    (order: number[], g: [string, string, string]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          await api.updateTrainConfig({
            wagon_order: order,
            goal_1: g[0] || "",
            goal_2: g[1] || "",
            goal_3: g[2] || "",
          });
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    []
  );

  const updateOrder = (order: number[]) => {
    setWagonOrder(order);
    scheduleSave(order, goals);
  };

  const updateGoal = (i: 0 | 1 | 2, v: string) => {
    const g: [string, string, string] = [...goals] as [string, string, string];
    g[i] = v;
    setGoals(g);
    scheduleSave(wagonOrder, g);
  };

  // ── DnD sensors ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  const depotIds = systems.filter((s) => !wagonOrder.includes(s.id)).map((s) => s.id);
  const trainIds = wagonOrder.filter((id) => systems.find((s) => s.id === id));

  function handleDragStart({ active }: DragStartEvent) {
    const id = Number(active.id);
    setActiveId(id);
    setActiveSource(wagonOrder.includes(id) ? "train" : "depot");
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const draggedId = Number(active.id);
    const overId = Number(over.id);
    const isOnTrain = wagonOrder.includes(draggedId);
    const overOnTrain = wagonOrder.includes(overId);

    if (!isOnTrain && overOnTrain) {
      // Animate: temporarily insert into train
      const overIdx = wagonOrder.indexOf(overId);
      if (!wagonOrder.includes(draggedId)) {
        const newOrder = [...wagonOrder];
        newOrder.splice(overIdx, 0, draggedId);
        setWagonOrder(newOrder);
      }
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const draggedId = Number(active.id);
    setActiveId(null);
    setActiveSource(null);

    if (!over) {
      // Dropped nowhere — if it was temporarily inserted, remove it
      if (activeSource === "depot") {
        setWagonOrder((prev) => prev.filter((id) => id !== draggedId));
      }
      return;
    }

    const overId = String(over.id);
    const overNumId = Number(over.id);

    const isNowOnTrain = wagonOrder.includes(draggedId);
    const overIsDepot = overId === "depot";
    const overOnTrain = wagonOrder.includes(overNumId);

    if (overIsDepot && isNowOnTrain && activeSource === "train") {
      // Move back to depot
      updateOrder(wagonOrder.filter((id) => id !== draggedId));
    } else if (overIsDepot && activeSource === "depot") {
      // Dropped on depot while coming from depot — no change, but clean up temp insert
      setWagonOrder((prev) => prev.filter((id) => id !== draggedId));
    } else if (overOnTrain) {
      if (activeSource === "depot") {
        // Was temporarily inserted via handleDragOver — finalize position
        const finalOrder = wagonOrder.includes(draggedId)
          ? wagonOrder
          : [...wagonOrder, draggedId];
        updateOrder(finalOrder);
      } else {
        // Reorder on train
        const oldIdx = wagonOrder.indexOf(draggedId);
        const newIdx = wagonOrder.indexOf(overNumId);
        if (oldIdx !== newIdx) {
          updateOrder(arrayMove(wagonOrder, oldIdx, newIdx));
        }
      }
    } else if (overId === "train-drop") {
      // Dropped on the empty track zone
      if (!wagonOrder.includes(draggedId)) {
        updateOrder([...wagonOrder, draggedId]);
      }
    }
  }

  // ── Scene sizing ──
  const LOCO_W = 200;
  const WAGON_W = 163; // 155px + 8px coupling
  const CASTLE_W = 260;
  const PADDING = 80;
  const sceneWidth = PADDING + LOCO_W + 16 + trainIds.length * WAGON_W + 60 + CASTLE_W + PADDING;
  const TRACK_Y = 300; // bottom of wagons sits on track

  // ── System → color index (stable by system id) ──
  const colorMap = new Map<number, number>();
  systems.forEach((s, i) => colorMap.set(s.id, i));

  const depotSystems = systems.filter((s) => !wagonOrder.includes(s.id));
  const activeSystem = activeId ? systems.find((s) => s.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Full-bleed layout: escape the page max-w */}
      <div className="-mx-4 md:-mx-8 -my-6 md:-my-10 flex h-[calc(100vh-3.5rem)] md:h-screen overflow-hidden">
        {/* ── Depot sidebar ── */}
        <aside
          className={`shrink-0 flex flex-col border-r border-slate-700/60 bg-slate-950/90 transition-all duration-300 ${sidebarOpen ? "w-48 md:w-52" : "w-10"}`}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center h-10 text-slate-400 hover:text-emerald-400 transition-colors border-b border-slate-700/60 shrink-0"
            title={sidebarOpen ? "Collapse depot" : "Expand depot"}
          >
            <span className="text-sm">{sidebarOpen ? "◀" : "▶"}</span>
          </button>

          {sidebarOpen && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-3 pt-3 pb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500/80">
                  Depot
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">Drag wagons onto the track</p>
              </div>

              <SortableContext items={depotIds} strategy={horizontalListSortingStrategy}>
                <DepotDropZone>
                  <div className="flex flex-col gap-2 px-2 pb-3 overflow-y-auto flex-1">
                    {depotSystems.length === 0 ? (
                      <p className="text-[10px] text-slate-600 italic px-1 pt-2">
                        All systems on track
                      </p>
                    ) : (
                      depotSystems.map((s) => (
                        <DepotItem key={s.id} system={s} colorIdx={colorMap.get(s.id) ?? 0} />
                      ))
                    )}
                  </div>
                </DepotDropZone>
              </SortableContext>

              {saving && (
                <p className="text-[9px] text-emerald-600 px-3 pb-2 shrink-0">saving…</p>
              )}
            </div>
          )}
        </aside>

        {/* ── Main scrollable scene ── */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden relative" ref={sceneRef}>
          <div style={{ width: sceneWidth, height: "100%", minHeight: 440, position: "relative" }}>
            {/* Background */}
            <SceneBackground width={sceneWidth} />

            {/* Train assembly — sits on the track */}
            <div
              style={{
                position: "absolute",
                left: PADDING,
                top: TRACK_Y - 130,
                display: "flex",
                alignItems: "flex-end",
                zIndex: 10,
              }}
            >
              {/* Locomotive */}
              <div style={{ flexShrink: 0 }}>
                <LocomotiveSVG />
              </div>

              {/* Track fill + wagons (sortable) */}
              <SortableContext items={trainIds} strategy={horizontalListSortingStrategy}>
                <TrainDropZone>
                  <div className="flex items-end" style={{ minWidth: 80, minHeight: 110 }}>
                    {trainIds.length === 0 && (
                      <div
                        className="flex items-center justify-center text-[10px] text-slate-500 italic border-2 border-dashed border-slate-600/40 rounded-lg"
                        style={{ width: 160, height: 80, marginBottom: 14, marginLeft: 20 }}
                      >
                        drop wagons here
                      </div>
                    )}
                    {trainIds.map((id, idx) => {
                      const sys = systems.find((s) => s.id === id);
                      if (!sys) return null;
                      return (
                        <SortableWagon
                          key={id}
                          systemId={id}
                          name={sys.name}
                          colorIdx={colorMap.get(id) ?? idx}
                        />
                      );
                    })}
                  </div>
                </TrainDropZone>
              </SortableContext>

              {/* Track fill to castle */}
              <div style={{ width: 60, alignSelf: "flex-end", marginBottom: 14 }}>
                <TrackFill width={60} />
              </div>

              {/* Castle */}
              <div style={{ alignSelf: "flex-end" }}>
                <CastleSVG goals={goals} onChange={updateGoal} />
              </div>
            </div>

            {/* Page title */}
            <div
              style={{ position: "absolute", top: 18, left: PADDING, zIndex: 20 }}
              className="flex items-center gap-3"
            >
              <div>
                <h1 className="text-xl font-black text-white drop-shadow-lg tracking-tight">
                  Mind<span className="text-emerald-400">Train</span>
                </h1>
                <p className="text-[10px] text-slate-400/80 mt-0.5">
                  Build your train · set the destination · drive forward
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay (mini wagon preview) */}
      <DragOverlay dropAnimation={null}>
        {activeSystem && (
          <div style={{ opacity: 0.85, transform: "rotate(-3deg) scale(0.9)" }}>
            <WagonSVG name={activeSystem.name} colorIdx={colorMap.get(activeSystem.id) ?? 0} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ── Drop zone wrappers ────────────────────────────────────────────────────────
function DepotDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "depot" });
  return (
    <div ref={setNodeRef} className="flex-1 overflow-y-auto">
      {children}
    </div>
  );
}

function TrainDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: "train-drop" });
  return <div ref={setNodeRef}>{children}</div>;
}
