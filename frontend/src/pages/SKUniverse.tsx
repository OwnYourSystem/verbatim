import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { SKRating, SpecificKnowledge } from "../types";
import { ratingColor, ratingGlow, ratingLabel } from "../components/Thermometer";

// ── Rating → 3D placement ─────────────────────────────────────────────────────
// HOT (rarest) orbits closest to the core; COLD orbits farthest out.
const ORBIT: Record<SKRating, number> = { hot: 130, warm: 230, cold: 330 };
const PLANET_SIZE: Record<SKRating, number> = { hot: 46, warm: 32, cold: 20 };

function planetColor(r: SKRating) {
  return ratingColor(r);
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
    const r = ORBIT[sk.rating];
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
  const [tilt, setTilt] = useState(55);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [tooltip, setTooltip] = useState<{ sk: SpecificKnowledge; x: number; y: number } | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const spinRef = useRef(20);
  const tiltRef = useRef(55);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    api.listSKs().then((all) => setSks(all.filter((sk) => sk.in_universe)));
  }, []);

  // Auto-spin while idle (gentle rotation), paused while the user drags.
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

  // Drag horizontally to orbit around (spin), vertically to change the viewing
  // angle (tilt) — i.e. move around the universe in 3D.
  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    last.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    spinRef.current = (spinRef.current + dx * 0.4) % 360;
    tiltRef.current = Math.max(10, Math.min(85, tiltRef.current - dy * 0.3));
    setSpin(spinRef.current);
    setTilt(tiltRef.current);
  };
  const onPointerUp = () => setDragging(false);
  const onWheel = (e: React.WheelEvent) => {
    setZoom((z) => Math.max(0.5, Math.min(2.2, z - e.deltaY * 0.001)));
  };

  const uniqueOrbits = [...new Set(sks.map((sk) => ORBIT[sk.rating]))].sort((a, b) => a - b);
  const angles = assignAngles(sks);

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{ height: "calc(100vh - 3.5rem)", background: "#020408", cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
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
          SK <span className="text-violet-400">Universe</span>
        </h1>
        <p className="text-[10px] text-slate-500 mt-0.5">Drag to move around · Scroll to zoom · Planets = earned knowledge</p>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none space-y-1">
        {(["hot", "warm", "cold"] as SKRating[]).map((r) => (
          <div key={r} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: ratingColor(r) }} />
            <span className="text-[10px] text-slate-400">{ratingLabel(r)}</span>
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
            transform: `scale(${zoom}) rotateX(${tilt}deg) rotateZ(${spin}deg)`,
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

          {/* Core star (unlabeled) */}
          <div
            className="absolute rounded-full pointer-events-none"
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
          />

          {/* Planets */}
          {sks.map((sk) => {
            const angle = angles.get(sk.id) ?? 0;
            const r = ORBIT[sk.rating];
            const rad = (angle * Math.PI) / 180;
            const x = r * Math.cos(rad);
            const y = r * Math.sin(rad);
            const size = PLANET_SIZE[sk.rating];
            const color = planetColor(sk.rating);

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
                  boxShadow: ratingGlow(sk.rating),
                  cursor: "pointer",
                  zIndex: 10,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseEnter={(e) => setTooltip({ sk, x: e.clientX, y: e.clientY })}
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
            <p className="text-slate-400 text-sm font-medium">The universe is empty</p>
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
              border: `1px solid ${planetColor(tooltip.sk.rating)}44`,
              backdropFilter: "blur(8px)",
            }}
          >
            <p className="font-bold text-white">{tooltip.sk.name}</p>
            <p style={{ color: planetColor(tooltip.sk.rating) }} className="mt-0.5">
              {ratingLabel(tooltip.sk.rating)}
            </p>
            <p className="text-slate-400 mt-0.5">{tooltip.sk.completed_count} task{tooltip.sk.completed_count !== 1 ? "s" : ""} completed</p>
          </div>
        </div>
      )}
    </div>
  );
}
