import { useEffect, useState } from "react";
import { api } from "../api";
import type { SKRating, SpecificKnowledge } from "../types";
import { PageHeader } from "../components/ui";
import { RATINGS, Thermometer, ratingColor, ratingLabel } from "../components/Thermometer";

type Filter = "all" | SKRating;

export function KnowledgePool() {
  const [sks, setSks] = useState<SpecificKnowledge[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRating, setNewRating] = useState<SKRating>("warm");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => api.listSKs().then(setSks).catch((e) => setError(String(e)));
  useEffect(() => { load(); }, []);

  const filtered = sks.filter((sk) => filter === "all" || sk.rating === filter);

  const addSK = async () => {
    if (!newName.trim()) return;
    await api.createSK({ name: newName.trim(), rating: newRating });
    setNewName(""); setNewRating("warm"); setAdding(false);
    load();
  };

  // Clicking the thermometer is a manual override → the backend marks it finalized.
  const onRatingChange = (sk: SpecificKnowledge, rating: SKRating) => {
    setSks((prev) => prev.map((s) => (s.id === sk.id ? { ...s, rating, rating_finalized: true } : s)));
    api.updateSK(sk.id, { rating }).then(load);
  };

  const saveEditName = async (id: number) => {
    await api.updateSK(id, { name: editName });
    setEditId(null);
    load();
  };

  const del = async (id: number) => {
    await api.deleteSK(id);
    load();
  };

  const filters: { key: Filter; label: string; color: string }[] = [
    { key: "all", label: "All", color: "#94a3b8" },
    { key: "hot", label: "Hot", color: ratingColor("hot") },
    { key: "warm", label: "Warm", color: ratingColor("warm") },
    { key: "cold", label: "Cold", color: ratingColor("cold") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Pool"
        subtitle="Every specific knowledge you have earned — rated HOT / WARM / COLD by how unique and not-teachable-elsewhere it is."
      />

      {error && <p className="text-amber-400 text-sm">{error}</p>}

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="text-xs px-3 py-1.5 rounded-full border transition-all"
            style={{
              borderColor: filter === f.key ? f.color : "rgba(255,255,255,0.1)",
              color: filter === f.key ? f.color : "#94a3b8",
              background: filter === f.key ? `${f.color}18` : "transparent",
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setAdding(true)}
          className="ml-auto text-xs px-3 py-1.5 rounded-full border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-all"
        >
          + Add SK
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl border border-emerald-500/30 bg-ink/10 dark:bg-slate-900/60">
          <div className="flex-1 min-w-48">
            <label className="text-[10px] text-ink-soft dark:text-slate-400 uppercase tracking-wider">Name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSK()}
              placeholder="e.g. SAP BTP Architecture"
              className="input-base w-full mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] text-ink-soft dark:text-slate-400 uppercase tracking-wider">Rating</label>
            <div className="flex gap-1 mt-1">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  onClick={() => setNewRating(r)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-md border transition-all"
                  style={{
                    color: newRating === r ? ratingColor(r) : "#94a3b8",
                    borderColor: newRating === r ? ratingColor(r) : "rgba(255,255,255,0.12)",
                    background: newRating === r ? `${ratingColor(r)}18` : "transparent",
                  }}
                >
                  {ratingLabel(r)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addSK} className="btn-primary text-sm">Save</button>
            <button onClick={() => setAdding(false)} className="text-sm text-ink-soft dark:text-slate-500 hover:text-ink dark:hover:text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {/* SK grid */}
      {filtered.length === 0 ? (
        <p className="text-ink-soft dark:text-slate-500 text-sm italic">
          {sks.length === 0
            ? "No specific knowledge yet. Define SKs on your tasks to populate this pool."
            : "No SKs in this rating."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sk) => {
            const color = ratingColor(sk.rating);
            const isEditing = editId === sk.id;
            return (
              <div
                key={sk.id}
                className="rounded-xl border bg-ink/10 dark:bg-slate-900/70 p-4 flex gap-3 items-start"
                style={{ borderColor: `${color}33`, transition: "border-color 0.25s" }}
              >
                {/* Thermometer — click a zone to override the rating */}
                <div className="shrink-0 mt-1" title="Click to set HOT / WARM / COLD">
                  <Thermometer rating={sk.rating} onChange={(r) => onRatingChange(sk, r)} />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEditName(sk.id); if (e.key === "Escape") setEditId(null); }}
                        className="input-base w-full text-sm"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => saveEditName(sk.id)} className="btn-primary text-xs py-1">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-ink-soft dark:text-slate-500">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-ink dark:text-slate-100 leading-tight">{sk.name}</span>
                        {sk.in_universe && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
                            In Universe
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color, background: `${color}18`, border: `1px solid ${color}44`, transition: "all 0.25s" }}
                        >
                          {ratingLabel(sk.rating)}
                        </span>
                        <span className="text-[10px] text-ink-soft dark:text-slate-500">
                          {sk.task_count} task{sk.task_count !== 1 ? "s" : ""}
                          {sk.completed_count > 0 && ` · ${sk.completed_count} done`}
                        </span>
                        {!sk.rating_finalized && (
                          <span className="text-[9px] text-ink-soft/70 dark:text-slate-600 italic" title="AI will finalize this on completion">
                            suggested
                          </span>
                        )}
                      </div>
                      {sk.ai_justification && (
                        <p className="text-[10px] text-ink-soft dark:text-slate-500 mt-1.5 leading-snug line-clamp-2">
                          {sk.ai_justification}
                        </p>
                      )}
                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => { setEditId(sk.id); setEditName(sk.name); }}
                          className="text-[10px] text-ink-soft dark:text-slate-500 hover:text-emerald-400 transition-colors"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => del(sk.id)}
                          className="text-[10px] text-ink-soft dark:text-slate-500 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
