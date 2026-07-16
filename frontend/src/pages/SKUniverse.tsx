import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { api } from "../api";
import type { SKRating, SpecificKnowledge } from "../types";
import { ratingColor, ratingLabel } from "../components/Thermometer";

// ── Rating → orbit placement (world units) ───────────────────────────────────
// HOT (rarest) orbits closest to the sun; COLD orbits farthest out.
const ORBIT: Record<SKRating, number> = { hot: 3.2, warm: 5.2, cold: 7.4 };
const PLANET_SIZE: Record<SKRating, number> = { hot: 0.5, warm: 0.36, cold: 0.24 };

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
      result.set(id, (Math.PI * 2 * i) / ids.length + 0.5);
    });
  });
  return result;
}

/** Procedurally painted sun surface — radial base + turbulent blobs — baked
 *  to a canvas and used as a real texture on a real sphere, so it rotates
 *  and lights like an actual 3D object instead of a flat CSS illusion. */
function makeSunTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const base = ctx.createRadialGradient(
    size * 0.4, size * 0.38, size * 0.05,
    size * 0.5, size * 0.5, size * 0.62,
  );
  base.addColorStop(0, "#fff9d6");
  base.addColorStop(0.35, "#ffe066");
  base.addColorStop(0.62, "#ffab1f");
  base.addColorStop(1, "#c8460c");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Turbulent granulation blobs, tiled so the wrap seam isn't obvious.
  const rand = (seed: number) => {
    const x = Math.sin(seed) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 90; i++) {
    const x = rand(i * 12.9898) * size;
    const y = rand(i * 78.233) * size;
    const r = 10 + rand(i * 37.719) * 40;
    const tone = rand(i * 4.14);
    const color = tone > 0.5 ? "255,250,220" : "200,60,10";
    const alpha = 0.08 + rand(i * 91.7) * 0.15;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** A soft radial-gradient sprite, used for the corona and each planet's glow
 *  — the standard lightweight technique for glows in a real-time 3D scene
 *  without a full bloom post-processing pass. */
function makeGlowTexture(colorHex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, colorHex + "cc");
  g.addColorStop(0.4, colorHex + "55");
  g.addColorStop(1, colorHex + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface PlanetMesh {
  mesh: THREE.Mesh;
  sk: SpecificKnowledge;
}

export function SKUniverse() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const planetsGroupRef = useRef<THREE.Group | null>(null);
  const planetMeshesRef = useRef<PlanetMesh[]>([]);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());

  const [sks, setSks] = useState<SpecificKnowledge[]>([]);
  const [tooltip, setTooltip] = useState<{ sk: SpecificKnowledge; x: number; y: number } | null>(null);

  useEffect(() => {
    api.listSKs().then((all) => setSks(all.filter((sk) => sk.in_universe)));
  }, []);

  // ── One-time scene setup ────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 200);
    camera.position.set(0, 6.5, 11);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x020408, 1);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Real orbit-camera controls: single-finger/mouse drag to rotate, pinch
    // or scroll to zoom, built-in momentum via damping — this is the exact
    // interaction model of NASA's Eyes/Earth-Now apps.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 26;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controlsRef.current = controls;

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1800;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 60 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, sizeAttenuation: true }),
    );
    scene.add(stars);

    // Sun
    const sunTexture = makeSunTexture();
    const sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 64, 64),
      new THREE.MeshBasicMaterial({ map: sunTexture }),
    );
    scene.add(sunMesh);

    const corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeGlowTexture("#ffaa33"),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    corona.scale.set(6, 6, 1);
    scene.add(corona);

    // Orbit rings
    const orbitRadii = Object.values(ORBIT);
    for (const r of orbitRadii) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 }),
      );
      scene.add(ring);
    }

    const planetsGroup = new THREE.Group();
    scene.add(planetsGroup);
    planetsGroupRef.current = planetsGroup;

    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const dt = clock.getDelta();
      sunMesh.rotation.y += dt * 0.05;
      const pulse = 1 + Math.sin(clock.elapsedTime * 1.4) * 0.06;
      corona.scale.set(6 * pulse, 6 * pulse, 1);
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    // Hover (desktop) + tap (any pointer) → raycast for the tooltip.
    const pointer = new THREE.Vector2();
    const raycast = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(pointer, camera);
      const meshes = planetMeshesRef.current.map((p) => p.mesh);
      const hits = raycasterRef.current.intersectObjects(meshes);
      if (hits.length > 0) {
        const hit = planetMeshesRef.current.find((p) => p.mesh === hits[0].object);
        if (hit) {
          setTooltip({ sk: hit.sk, x: clientX, y: clientY });
          return;
        }
      }
      setTooltip(null);
    };
    const onPointerMove = (e: PointerEvent) => raycast(e.clientX, e.clientY);
    const onClick = (e: MouseEvent) => raycast(e.clientX, e.clientY);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      controls.dispose();
      renderer.dispose();
      sunTexture.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // ── Rebuild planet meshes whenever the data changes ─────────────────────
  useEffect(() => {
    const group = planetsGroupRef.current;
    if (!group) return;

    // Clear previous planets.
    for (const child of [...group.children]) {
      group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
    planetMeshesRef.current = [];

    const angles = assignAngles(sks);
    for (const sk of sks) {
      const angle = angles.get(sk.id) ?? 0;
      const r = ORBIT[sk.rating];
      const size = PLANET_SIZE[sk.rating];
      const color = ratingColor(sk.rating);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(size, 32, 32),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
      group.add(mesh);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeGlowTexture(color),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.scale.set(size * 4.5, size * 4.5, 1);
      mesh.add(glow);

      planetMeshesRef.current.push({ mesh, sk });
    }
  }, [sks]);

  const resetView = () => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    camera.position.set(0, 6.5, 11);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  return (
    <div
      className="relative w-full overflow-hidden select-none touch-none"
      style={{ height: "calc(100vh - 3.5rem)", background: "#020408" }}
    >
      <div ref={containerRef} className="absolute inset-0" />

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

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 pointer-events-none" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div
            className="rounded-lg px-3 py-2 text-xs shadow-xl"
            style={{
              background: "rgba(10,15,30,0.95)",
              border: `1px solid ${ratingColor(tooltip.sk.rating)}44`,
              backdropFilter: "blur(8px)",
            }}
          >
            <p className="font-bold text-white">{tooltip.sk.name}</p>
            <p style={{ color: ratingColor(tooltip.sk.rating) }} className="mt-0.5">
              {ratingLabel(tooltip.sk.rating)}
            </p>
            <p className="text-slate-400 mt-0.5">
              {tooltip.sk.completed_count} task{tooltip.sk.completed_count !== 1 ? "s" : ""} completed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
