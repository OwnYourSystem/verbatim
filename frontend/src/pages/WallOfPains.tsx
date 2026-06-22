import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type {
  AIProjectAssist,
  MonetizationModel,
  Pain,
  PainArea,
  PainDiscoveryItem,
  ProjectPhase,
} from "../types";
import { PageHeader } from "../components/ui";

// ── Constants ─────────────────────────────────────────────────────────────────
const AREA_META: Record<PainArea, { label: string; color: string; bg: string }> = {
  data_engineering: { label: "Data Engineering", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  ml: { label: "ML", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
  ai: { label: "AI", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

const MONO_META: Record<
  MonetizationModel,
  { label: string; icon: string; desc: string; color: string }
> = {
  saas: { label: "SaaS", icon: "💳", desc: "Monthly subscription, recurring revenue", color: "#3b82f6" },
  api_product: { label: "API Product", icon: "⚡", desc: "Pay-per-use, developer-friendly", color: "#f59e0b" },
  consulting: { label: "Consulting", icon: "🤝", desc: "Services, high margin, slow scale", color: "#ec4899" },
  course: { label: "Course", icon: "📚", desc: "One-time or cohort, educational", color: "#06b6d4" },
  open_source_premium: { label: "OSS + Premium", icon: "🌱", desc: "Community + paid tier", color: "#22c55e" },
  marketplace: { label: "Marketplace", icon: "🏪", desc: "Platform connecting buyers/sellers", color: "#a855f7" },
};

const PHASES: { key: ProjectPhase; label: string; color: string }[] = [
  { key: "idea", label: "Idea", color: "#64748b" },
  { key: "validate", label: "Validate", color: "#f59e0b" },
  { key: "build", label: "Build", color: "#3b82f6" },
  { key: "launch", label: "Launch", color: "#10b981" },
];

type AreaFilter = "all" | PainArea;

// ── Helpers ───────────────────────────────────────────────────────────────────
function shorten(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// ── Project panel ─────────────────────────────────────────────────────────────
function ProjectPanel({
  pain,
  onUpdated,
}: {
  pain: Pain;
  onUpdated: (p: Pain) => void;
}) {
  const proj = pain.project;
  const [name, setName] = useState(proj?.name ?? "");
  const [stmt, setStmt] = useState(proj?.problem_statement ?? "");
  const [audience, setAudience] = useState(proj?.target_audience ?? "");
  const [mono, setMono] = useState<MonetizationModel | "">(
    (proj?.monetization_model as MonetizationModel) ?? ""
  );
  const [phase, setPhase] = useState<ProjectPhase>(proj?.phase ?? "idea");
  const [assisting, setAssisting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingSystem, setCreatingSystem] = useState(false);

  const fillFromAssist = (a: AIProjectAssist) => {
    setName(a.name);
    setStmt(a.problem_statement);
    setAudience(a.target_audience);
    setMono(a.monetization_model);
  };

  const assist = async () => {
    setAssisting(true);
    try {
      const r = await api.assistProject(pain.id);
      fillFromAssist(r);
    } finally {
      setAssisting(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        problem_statement: stmt || null,
        target_audience: audience || null,
        monetization_model: mono || null,
        phase,
      };
      const updated = proj
        ? await api.updateProject(pain.id, body)
        : await api.createProject(pain.id, body);
      onUpdated(updated);
    } finally {
      setSaving(false);
    }
  };

  const createSystem = async () => {
    setCreatingSystem(true);
    try {
      const updated = await api.createSystemFromProject(pain.id);
      onUpdated(updated);
    } finally {
      setCreatingSystem(false);
    }
  };

  const currentPhaseIdx = PHASES.findIndex((p) => p.key === phase);

  return (
    <div className="border-t border-slate-700/60 pt-4 mt-4 space-y-4">
      {/* AI Assist */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
          Project Definition
        </p>
        <button
          onClick={assist}
          disabled={assisting}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 transition-all disabled:opacity-50"
        >
          {assisting ? (
            <span className="animate-spin">⟳</span>
          ) : (
            "✦"
          )}
          {assisting ? "Thinking…" : "AI Assist"}
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">
          Project / Product Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. PipelineGuard"
          className="input-base w-full mt-1 text-sm"
        />
      </div>

      {/* Problem statement */}
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">
          Problem Statement
        </label>
        <textarea
          value={stmt}
          onChange={(e) => setStmt(e.target.value)}
          placeholder="Who suffers from this pain, and why does no current solution work?"
          rows={2}
          className="input-base w-full mt-1 text-sm resize-none"
        />
      </div>

      {/* Target audience */}
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wider">
          Target Audience / Buyer
        </label>
        <input
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          placeholder="e.g. Data engineers at Series B+ startups"
          className="input-base w-full mt-1 text-sm"
        />
      </div>

      {/* Monetization model */}
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 block">
          Monetization Model
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.keys(MONO_META) as MonetizationModel[]).map((m) => {
            const meta = MONO_META[m];
            const selected = mono === m;
            return (
              <button
                key={m}
                onClick={() => setMono(m)}
                className="text-left p-2.5 rounded-lg border text-[11px] transition-all"
                style={{
                  borderColor: selected ? meta.color : "rgba(255,255,255,0.08)",
                  background: selected ? `${meta.color}18` : "rgba(255,255,255,0.02)",
                  color: selected ? meta.color : "#94a3b8",
                }}
              >
                <span className="text-base mr-1">{meta.icon}</span>
                <span className="font-semibold">{meta.label}</span>
                <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">{meta.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Phase stepper */}
      <div>
        <label className="text-[10px] text-slate-400 uppercase tracking-wider mb-2 block">
          Phase
        </label>
        <div className="flex gap-1">
          {PHASES.map((p, i) => {
            const active = i <= currentPhaseIdx;
            const current = p.key === phase;
            return (
              <button
                key={p.key}
                onClick={() => setPhase(p.key)}
                className="flex-1 py-1.5 rounded text-[10px] font-bold border transition-all"
                style={{
                  borderColor: active ? p.color : "rgba(255,255,255,0.08)",
                  background: current ? `${p.color}22` : active ? `${p.color}0a` : "transparent",
                  color: active ? p.color : "#475569",
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save */}
      <div className="flex gap-3 items-center pt-1">
        <button
          onClick={save}
          disabled={!name.trim() || saving}
          className="btn-primary text-sm disabled:opacity-40"
        >
          {saving ? "Saving…" : proj ? "Update Project" : "Save Project"}
        </button>
        {proj && !proj.system_id && (
          <button
            onClick={createSystem}
            disabled={creatingSystem}
            className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 font-semibold transition-all disabled:opacity-40"
          >
            {creatingSystem ? "Creating…" : "Create System in MindAnchor →"}
          </button>
        )}
        {proj?.system_id && (
          <Link
            to="/systems"
            className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            System: {proj.system_name} ↗
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Pain card ─────────────────────────────────────────────────────────────────
function PainCard({
  pain,
  onDelete,
  onUpdated,
}: {
  pain: Pain;
  onDelete: () => void;
  onUpdated: (p: Pain) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const area = AREA_META[pain.area] ?? AREA_META.ai;
  const proj = pain.project;
  const currentPhase = proj ? PHASES.find((p) => p.key === proj.phase) : null;
  const mono = proj?.monetization_model ? MONO_META[proj.monetization_model] : null;

  return (
    <div
      className="rounded-xl border bg-slate-900/70 overflow-hidden flex flex-col"
      style={{ borderColor: `${area.color}28` }}
    >
      {/* Coloured top bar */}
      <div className="h-1" style={{ background: area.color }} />

      <div className="p-4 flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex gap-1.5 flex-wrap flex-1">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ color: area.color, background: area.bg }}
            >
              {area.label}
            </span>
            {pain.source_platform && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                {pain.source_platform}
              </span>
            )}
            {pain.is_ai_fetched && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-900/40 text-violet-300 border border-violet-700/40">
                AI-discovered
              </span>
            )}
          </div>
          <button
            onClick={onDelete}
            className="text-slate-600 hover:text-red-400 transition-colors text-sm shrink-0"
            title="Remove pain"
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm text-slate-100 leading-snug mb-2">{pain.title}</h3>

        {/* Description */}
        {pain.description && (
          <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-3 mb-3">
            {pain.description}
          </p>
        )}

        {/* Source link */}
        {pain.source_url && (
          <a
            href={pain.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors mb-3 flex items-center gap-1"
          >
            ↗ {shorten(pain.source_url)}
          </a>
        )}

        {/* Project summary (if exists, collapsed) */}
        {proj && !expanded && (
          <div
            className="rounded-lg border p-2.5 mb-3 cursor-pointer hover:border-slate-600 transition-all"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}
            onClick={() => setExpanded(true)}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-200">{proj.name}</span>
              {mono && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ color: mono.color, background: `${mono.color}18` }}
                >
                  {mono.icon} {mono.label}
                </span>
              )}
              {currentPhase && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ color: currentPhase.color, background: `${currentPhase.color}18` }}
                >
                  {currentPhase.label}
                </span>
              )}
              {proj.system_id && (
                <span className="text-[10px] text-emerald-400">✓ System created</span>
              )}
            </div>
            {/* Phase progress dots */}
            <div className="flex gap-1 mt-2">
              {PHASES.map((p, i) => {
                const phaseIdx = PHASES.findIndex((ph) => ph.key === proj.phase);
                return (
                  <div
                    key={p.key}
                    className="h-1 flex-1 rounded-full transition-all"
                    style={{
                      background: i <= phaseIdx ? p.color : "rgba(255,255,255,0.08)",
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Expand/collapse project panel */}
        <div className="mt-auto">
          {!expanded ? (
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-2 rounded-lg border border-dashed text-[11px] text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-all"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}
            >
              {proj ? "Edit Project →" : "Define Project →"}
            </button>
          ) : (
            <>
              <ProjectPanel pain={pain} onUpdated={(p) => { onUpdated(p); setExpanded(false); }} />
              <button
                onClick={() => setExpanded(false)}
                className="mt-3 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
              >
                Collapse ▲
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Discovery preview strip ───────────────────────────────────────────────────
function DiscoveryPreview({
  items,
  onAdd,
}: {
  items: PainDiscoveryItem[];
  onAdd: (item: PainDiscoveryItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-violet-400">
        AI-Discovered Pains — click to add to your wall
      </p>
      <div className="space-y-2">
        {items.map((item, i) => {
          const area = AREA_META[item.area as PainArea] ?? AREA_META.ai;
          return (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg border bg-slate-900/60 border-slate-700/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex gap-2 mb-1 flex-wrap">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ color: area.color, background: area.bg }}
                  >
                    {area.label}
                  </span>
                  {item.source_platform && (
                    <span className="text-[10px] text-slate-500">{item.source_platform}</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-200">{item.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                {item.source_url && (
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-slate-600 hover:text-emerald-400 transition-colors"
                  >
                    ↗ {shorten(item.source_url)}
                  </a>
                )}
              </div>
              <button
                onClick={() => onAdd(item)}
                className="shrink-0 text-[10px] px-2.5 py-1.5 rounded-lg border border-violet-500/40 text-violet-300 hover:bg-violet-500/10 transition-all whitespace-nowrap"
              >
                + Add to Wall
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function WallOfPains() {
  const [pains, setPains] = useState<Pain[]>([]);
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("all");
  const [discovering, setDiscovering] = useState(false);
  const [discoveryItems, setDiscoveryItems] = useState<PainDiscoveryItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newPlatform, setNewPlatform] = useState("");
  const [newArea, setNewArea] = useState<PainArea>("ai");
  const [error, setError] = useState<string | null>(null);

  const load = (area?: string) =>
    api.listPains(area !== "all" ? area : undefined)
      .then(setPains)
      .catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);

  const filtered = areaFilter === "all"
    ? pains
    : pains.filter((p) => p.area === areaFilter);

  const discover = async () => {
    setDiscovering(true);
    setDiscoveryItems([]);
    try {
      const items = await api.discoverPains(areaFilter === "all" ? "all" : areaFilter);
      setDiscoveryItems(items);
    } catch (e) {
      setError(String(e));
    } finally {
      setDiscovering(false);
    }
  };

  const addDiscovered = async (item: PainDiscoveryItem) => {
    await api.createPain({ ...item, is_ai_fetched: true });
    setDiscoveryItems((prev) => prev.filter((i) => i !== item));
    load();
  };

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await api.createPain({
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      source_url: newUrl.trim() || undefined,
      source_platform: newPlatform.trim() || undefined,
      area: newArea,
      is_ai_fetched: false,
    });
    setNewTitle(""); setNewDesc(""); setNewUrl(""); setNewPlatform("");
    setShowAddForm(false);
    load();
  };

  const del = async (id: number) => {
    await api.deletePain(id);
    setPains((prev) => prev.filter((p) => p.id !== id));
  };

  const updated = (updated: Pain) => {
    setPains((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const areaFilters: { key: AreaFilter; label: string }[] = [
    { key: "all", label: "All Areas" },
    { key: "data_engineering", label: "Data Engineering" },
    { key: "ml", label: "ML" },
    { key: "ai", label: "AI" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wall of Pains"
        subtitle="Find real problems in Data Engineering, ML & AI. Define your solution. Build your product. Make money."
      />

      {error && <p className="text-amber-400 text-sm">{error}</p>}

      {/* Filter + action bar */}
      <div className="flex flex-wrap gap-2 items-center">
        {areaFilters.map((f) => {
          const color =
            f.key === "all"
              ? "#94a3b8"
              : AREA_META[f.key as PainArea]?.color ?? "#94a3b8";
          return (
            <button
              key={f.key}
              onClick={() => setAreaFilter(f.key)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all"
              style={{
                borderColor: areaFilter === f.key ? color : "rgba(255,255,255,0.1)",
                color: areaFilter === f.key ? color : "#94a3b8",
                background: areaFilter === f.key ? `${color}18` : "transparent",
              }}
            >
              {f.label}
            </button>
          );
        })}

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-400 hover:border-slate-400 hover:text-slate-200 transition-all"
          >
            + Add Pain
          </button>
          <button
            onClick={discover}
            disabled={discovering}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-violet-500/50 text-violet-300 hover:bg-violet-500/10 font-semibold transition-all disabled:opacity-50"
          >
            {discovering ? (
              <>
                <span className="animate-spin inline-block">⟳</span>
                Scanning…
              </>
            ) : (
              <>✦ Discover Pains</>
            )}
          </button>
        </div>
      </div>

      {/* Manual add form */}
      {showAddForm && (
        <form
          onSubmit={addManual}
          className="p-4 rounded-xl border border-slate-700/60 bg-slate-900/60 space-y-3"
        >
          <div className="flex flex-wrap gap-3">
            <input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Pain title (required)"
              className="input-base flex-1 min-w-48"
            />
            <select
              value={newArea}
              onChange={(e) => setNewArea(e.target.value as PainArea)}
              className="input-base w-44"
            >
              <option value="data_engineering">Data Engineering</option>
              <option value="ml">ML</option>
              <option value="ai">AI</option>
            </select>
          </div>
          <textarea
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description — what hurts and why?"
            rows={2}
            className="input-base w-full resize-none"
          />
          <div className="flex flex-wrap gap-3">
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Source URL (optional)"
              className="input-base flex-1"
            />
            <input
              value={newPlatform}
              onChange={(e) => setNewPlatform(e.target.value)}
              placeholder="Platform (Substack, Reddit…)"
              className="input-base w-44"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm">Add to Wall</button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Discovery preview */}
      {discoveryItems.length > 0 && (
        <DiscoveryPreview items={discoveryItems} onAdd={addDiscovered} />
      )}

      {/* Wall grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-4xl">🩹</p>
          <p className="text-slate-400 font-medium">No pains on the wall yet</p>
          <p className="text-slate-600 text-sm">
            Click <strong className="text-violet-300">✦ Discover Pains</strong> to have AI scan current problems,
            or add your own.
          </p>
          <button
            onClick={discover}
            disabled={discovering}
            className="mx-auto flex items-center gap-2 px-5 py-2.5 rounded-xl border border-violet-500/50 text-violet-300 hover:bg-violet-500/10 font-semibold transition-all disabled:opacity-50"
          >
            {discovering ? "Scanning…" : "✦ Discover Pains"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((pain) => (
            <PainCard
              key={pain.id}
              pain={pain}
              onDelete={() => del(pain.id)}
              onUpdated={updated}
            />
          ))}
        </div>
      )}
    </div>
  );
}
