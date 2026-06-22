import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { SpecificKnowledge } from "../types";

// ── Colour + size helpers ────────────────────────────────────────────────────
function planetColor(t: number): string {
  if (t >= 9) return "#ef4444";
  if (t >= 7) return "#f97316";
  if (t >= 4) return "#14b8a6";
  return "#3b82f6";
}
function planetGlow(t: number): string {
  if (t >= 9) return "0 0 18px 6px rgba(239,68,68,0.55)";
  if (t >= 7) return "0 0 14px 4px rgba(249,115,22,0.45)";
  if (t >= 4) return "0 0 10px 3px rgba(20,184,166,0.35)";
  return "0 0 8px 2px rgba(59,130,246,0.3)";
}
function planetSize(t: number): number {
  return Math.round(12 + ((t - 1) / 9) * 38);
}

// Orbit radius: HOT (rare) = inner (close to you), COLD = outer
function orbitRadius(t: number): number {
  const ORBITS = [100, 150, 200, 255, 310, 365];
  // temp 10→orbit[0], temp 1→orbit[5]
  const idx = Math.min(5, Math.floor(((10 - t) / 9) * 5.99));
  return ORBITS[idx];
}

function tempLabel(t: number): string {
  if (t >= 9) return "Blazing";
  if (t >= 7) return "Hot";
  if (t >= 4) return "Warm";
  return "Cold";
}

// ── Generate random stars ────────────────────────────────────────────────────
const STARS = Array.from({ length: 160 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 0.8 + Math.random() * 1.8,
  opacity: 0.3 + Math.random() * 0.7,
}));

// ── Assign angles to planets that share an orbit ────────────────────────────
function assignAngles(planets: SpecificKnowledge[]): Map<number, number> {
  const orbitGroups = new Map<number, number[]>();
  planets.forEach((sk) => {
    const r = orbitRadius(sk.temperature);
    if (!orbitGroups.has(r)) orbitGroups.set(r, []);
    orbitGroups.get(r)!.push(sk.id);
  });
  const result = new Map<number, number>();
  orbitGroups.forEach((ids) => {
    ids.forEach((id, i) => {
      result.set(id, (360 / ids.length) * i + 30);
    });
  });
  return result;
}

export function SKUniverse() {
  const [sks, setSks] = useState<SpecificKnowledge[]>([]);
  const [spin, setSpin] = useState(20);
  const [tilt] = useState(55);
  const [dragging, setDragging] = useState(false);
  const [tooltip, setTooltip] = useState<{ sk: SpecificKnowledge; x: number; y: number } | null>(null);
  const lastX = useRef(0);
  const spinRef = useRef(20);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.listSKs().then((all) => setSks(all.filter((sk) => sk.in_universe)));
  }, []);

  // Auto-spin (1 full rotation per 60s = 6 deg/s)
  useEffect(() => {
    if (dragging) {
      if (animRef.current) clearInterval(animRef.current);
      return;
    }
    animRef.current = setInterval(() => {
      spinRef.current = (spinRef.current + 0.1) % 360;
      setSpin(spinRef.current);
    }, 16);
    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [dragging]);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    lastX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    spinRef.current = (spinRef.current + dx * 0.4) % 360;
    setSpin(spinRef.current);
  };
  const onPointerUp = () => setDragging(false);

  const uniqueOrbits = [...new Set(sks.map((sk) => orbitRadius(sk.temperature)))].sort((a, b) => a - b);
  const angles = assignAngles(sks);

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: "calc(100vh - 3.5rem)", background: "#020408", cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/* Stars */}
      {STARS.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size, opacity: s.opacity }}
        />
      ))}

      {/* Milky Way band */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(125deg, transparent 20%, rgba(130,80,200,0.06) 35%, rgba(180,120,255,0.1) 50%, rgba(130,80,200,0.06) 65%, transparent 80%)",
        }}
      />

      {/* Page label */}
      <div className="absolute top-4 left-6 z-20 pointer-events-none">
        <h1 className="text-lg font-black text-white/90 tracking-tight">
          My SK <span className="text-violet-400">Universe</span>
        </h1>
        <p className="text-[10px] text-slate-500 mt-0.5">Drag to rotate · Planets = earned knowledge</p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none space-y-1">
        {[
          { label: "Blazing (9-10)", color: "#ef4444" },
          { label: "Hot (7-8)", color: "#f97316" },
          { label: "Warm (4-6)", color: "#14b8a6" },
          { label: "Cold (1-3)", color: "#3b82f6" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
            <span className="text-[10px] text-slate-400">{l.label}</span>
          </div>
        ))}
        <p className="text-[9px] text-slate-600 pt-1">Closer = rarer · Bigger = rarer</p>
      </div>

      {/* 3D scene */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: "900px", perspectiveOrigin: "50% 40%" }}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${tilt}deg) rotateZ(${spin}deg)`,
            width: 800,
            height: 800,
            position: "relative",
          }}
        >
          {/* Orbital rings */}
          {uniqueOrbits.map((r) => (
            <div
              key={r}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: r * 2,
                height: r * 2,
                left: "50%",
                top: "50%",
                marginLeft: -r,
                marginTop: -r,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
          ))}

          {/* Asteroid belt visual (between orbit 3 and 4) */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 460,
              height: 460,
              left: "50%",
              top: "50%",
              marginLeft: -230,
              marginTop: -230,
              border: "8px dotted rgba(180,140,80,0.12)",
            }}
          />

          {/* Sun (YOU) */}
          <div
            className="absolute flex items-center justify-center rounded-full pointer-events-none"
            style={{
              width: 80,
              height: 80,
              left: "50%",
              top: "50%",
              marginLeft: -40,
              marginTop: -40,
              background: "radial-gradient(circle at 38% 38%, #fff7cc, #ffe566 40%, #ff9900 70%, #cc4400)",
              boxShadow: "0 0 60px 25px rgba(255,180,0,0.5), 0 0 120px 50px rgba(255,120,0,0.25)",
            }}
          >
            <span
              className="text-[9px] font-black text-amber-900 tracking-widest"
              style={{ transform: "translateZ(1px)" }}
            >
              YOU
            </span>
          </div>

          {/* Planets */}
          {sks.map((sk) => {
            const angle = angles.get(sk.id) ?? 0;
            const r = orbitRadius(sk.temperature);
            const rad = (angle * Math.PI) / 180;
            const x = r * Math.cos(rad);
            const y = r * Math.sin(rad);
            const size = planetSize(sk.temperature);
            const color = planetColor(sk.temperature);

            return (
              <div
                key={sk.id}
                className="absolute rounded-full"
                style={{
                  width: size,
                  height: size,
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  marginLeft: -size / 2,
                  marginTop: -size / 2,
                  background: `radial-gradient(circle at 38% 35%, rgba(255,255,255,0.35), ${color})`,
                  boxShadow: planetGlow(sk.temperature),
                  cursor: "pointer",
                  zIndex: 10,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={(e) =>
                  setTooltip({ sk, x: e.clientX, y: e.clientY })
                }
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
        </div>
      </div>

      {/* Empty state */}
      {sks.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl mb-3">🪐</p>
            <p className="text-slate-400 text-sm font-medium">Your universe is empty</p>
            <p className="text-slate-600 text-xs mt-1">Complete tasks with Specific Knowledge assigned to earn planets</p>
          </div>
        </div>
      )}

      {/* Tooltip (outside 3D transform — stays flat) */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div
            className="rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{
              background: "rgba(10,15,30,0.95)",
              border: `1px solid ${planetColor(tooltip.sk.temperature)}44`,
              backdropFilter: "blur(8px)",
            }}
          >
            <p className="font-bold text-white">{tooltip.sk.name}</p>
            <p style={{ color: planetColor(tooltip.sk.temperature) }} className="mt-0.5">
              T{tooltip.sk.temperature} · {tempLabel(tooltip.sk.temperature)}
            </p>
            <p className="text-slate-400 mt-0.5">{tooltip.sk.completed_count} task{tooltip.sk.completed_count !== 1 ? "s" : ""} completed</p>
          </div>
        </div>
      )}
    </div>
  );
}
