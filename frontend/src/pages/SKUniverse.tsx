import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { SKRating, SpecificKnowledge } from "../types";
import { ratingColor, ratingGlow, ratingLabel } from "../components/Thermometer";

// ── Rating → 3D placement ─────────────────────────────────────────────────────
// HOT (rarest) orbits closest to the core; COLD orbits farthest out.
const ORBIT: Record<SKRating, number> = { hot: 130, warm: 230, cold: 330 };
const PLANET_SIZE: Record<SKRating, number> = { hot: 46, warm: 32, cold: 20 };

const IDLE_SPIN_DEG_PER_MS = 0.006; // gentle constant drift when nothing else is happening
const FRICTION = 0.94; // per-frame velocity decay after a flick/drag release
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.6;
const MIN_TILT = 10;
const MAX_TILT = 85;

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

/** The sun — layered radial gradient body, a rotating granulation/flare
 *  texture clipped to the disc, and a slow-pulsing corona glow. Pure CSS
 *  (no WebGL), in keeping with the rest of this lightweight scene. */
function SunCore() {
  return (
    <div
      className="absolute pointer-events-none"
      style={{ width: 96, height: 96, left: "50%", top: "50%", marginLeft: -48, marginTop: -48 }}
    >
      {/* Corona — soft outer glow, breathing. A radial-gradient rather than a
          box-shadow: box-shadow can rasterize as a hard edge under an
          ancestor's 3D transform in Chromium, which read as an unwanted
          ring around the disc once tilted. */}
      <div
        className="absolute rounded-full"
        style={{
          inset: "-70%",
          background:
            "radial-gradient(circle, rgba(255,190,60,0.5) 0%, rgba(255,150,20,0.28) 38%, rgba(255,110,0,0.12) 60%, transparent 75%)",
          animation: "sun-corona-pulse 4s ease-in-out infinite",
        }}
      />
      {/* Photosphere body — gradient itself carries the limb-darkening falloff
          toward the edge, so it survives the elliptical squash from the 3D
          tilt without an inset-shadow ring artifact. */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: "radial-gradient(circle at 38% 35%, #fff9d6, #ffe066 34%, #ffab1f 60%, #e8620f 82%, #b93a0a 100%)",
        }}
      >
        {/* Rotating surface granulation / flare texture, clipped to the disc */}
        <div
          className="absolute"
          style={{
            inset: "-20%",
            animation: "sun-surface-rotate 22s linear infinite",
            background:
              "radial-gradient(circle at 30% 70%, rgba(255,255,255,0.3), transparent 22%)," +
              "radial-gradient(circle at 75% 30%, rgba(255,240,180,0.25), transparent 20%)," +
              "radial-gradient(circle at 60% 80%, rgba(200,50,0,0.3), transparent 25%)",
          }}
        />
      </div>
    </div>
  );
}

export function SKUniverse() {
  const [sks, setSks] = useState<SpecificKnowledge[]>([]);
  const [spin, setSpin] = useState(20);
  const [tilt, setTilt] = useState(55);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [tooltip, setTooltip] = useState<{ sk: SpecificKnowledge; x: number; y: number } | null>(null);

  const spinRef = useRef(20);
  const tiltRef = useRef(55);
  const zoomRef = useRef(1);
  const velocityRef = useRef({ x: 0, y: 0 }); // deg/ms, decays after release (momentum)
  const lastPointRef = useRef({ x: 0, y: 0, t: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    api.listSKs().then((all) => setSks(all.filter((sk) => sk.in_universe)));
  }, []);

  // Single animation loop: idle auto-drift + momentum decay after a flick.
  // Momentum smoothly bleeds into the same constant idle drift rather than
  // fighting it, so there's no jarring hand-off when a flick settles.
  useEffect(() => {
    let lastT = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(48, t - lastT); // clamp so a stalled tab doesn't jump
      lastT = t;
      if (!draggingRef.current) {
        spinRef.current = (spinRef.current + IDLE_SPIN_DEG_PER_MS * dt + velocityRef.current.x * dt) % 360;
        tiltRef.current = Math.max(
          MIN_TILT,
          Math.min(MAX_TILT, tiltRef.current + velocityRef.current.y * dt),
        );
        velocityRef.current.x *= FRICTION;
        velocityRef.current.y *= FRICTION;
        if (Math.abs(velocityRef.current.x) < 0.00002) velocityRef.current.x = 0;
        if (Math.abs(velocityRef.current.y) < 0.00002) velocityRef.current.y = 0;
        setSpin(spinRef.current);
        setTilt(tiltRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pinchDistance = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      // Second finger down — switch to pinch-zoom mode.
      pinchStartDistRef.current = pinchDistance();
      pinchStartZoomRef.current = zoomRef.current;
      draggingRef.current = false;
      setDragging(false);
    } else {
      draggingRef.current = true;
      setDragging(true);
      velocityRef.current = { x: 0, y: 0 };
      lastPointRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2) {
      // Pinch-to-zoom — the touch-native equivalent of the desktop scroll wheel.
      const dist = pinchDistance();
      if (dist && pinchStartDistRef.current) {
        const nextZoom = pinchStartZoomRef.current * (dist / pinchStartDistRef.current);
        zoomRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextZoom));
        setZoom(zoomRef.current);
      }
      return;
    }

    if (!draggingRef.current) return;
    const now = performance.now();
    const dx = e.clientX - lastPointRef.current.x;
    const dy = e.clientY - lastPointRef.current.y;
    const dt = Math.max(1, now - lastPointRef.current.t);

    spinRef.current = (spinRef.current + dx * 0.4) % 360;
    tiltRef.current = Math.max(MIN_TILT, Math.min(MAX_TILT, tiltRef.current - dy * 0.3));
    setSpin(spinRef.current);
    setTilt(tiltRef.current);

    // Track instantaneous velocity so a flick keeps drifting after release.
    velocityRef.current = { x: (dx * 0.4) / dt, y: (-dy * 0.3) / dt };
    lastPointRef.current = { x: e.clientX, y: e.clientY, t: now };
  };

  const endPointer = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchStartDistRef.current = null;
    if (pointersRef.current.size === 0) {
      draggingRef.current = false;
      setDragging(false);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    zoomRef.current = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomRef.current - e.deltaY * 0.001));
    setZoom(zoomRef.current);
  };

  const resetView = useCallback(() => {
    zoomRef.current = 1;
    tiltRef.current = 55;
    velocityRef.current = { x: 0, y: 0 };
    setZoom(1);
    setTilt(55);
  }, []);

  const uniqueOrbits = [...new Set(sks.map((sk) => ORBIT[sk.rating]))].sort((a, b) => a - b);
  const angles = assignAngles(sks);

  return (
    <div
      className="relative w-full overflow-hidden select-none touch-none"
      style={{ height: "calc(100vh - 3.5rem)", background: "#020408", cursor: dragging ? "grabbing" : "grab" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
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
        <p className="text-[10px] text-slate-500 mt-0.5">Drag to move around · Pinch or scroll to zoom · Planets = earned knowledge</p>
      </div>

      {/* Reset view */}
      <button
        onClick={resetView}
        className="absolute top-4 right-4 z-20 text-[10px] font-semibold text-slate-400 hover:text-slate-200 border border-slate-700/60 hover:border-slate-500 rounded-full px-3 py-1.5 transition-colors bg-slate-950/40 backdrop-blur-sm"
      >
        Reset view
      </button>

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

          <SunCore />

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
