import { useEffect, useState } from "react";
import { api } from "../api";
import type { SpecificKnowledge } from "../types";
import { PageHeader } from "../components/ui";

type Filter = "all" | "hot" | "warm" | "cold";

function tempLabel(t: number) {
  if (t >= 7) return "Hot";
  if (t >= 4) return "Warm";
  return "Cold";
}
function tempColor(t: number): string {
  if (t >= 9) return "#ef4444";
  if (t >= 7) return "#f97316";
  if (t >= 4) return "#14b8a6";
  return "#3b82f6";
}

function Thermometer({ temperature }: { temperature: number }) {
  const pct = ((temperature - 1) / 9) * 100;
  const color = tempColor(temperature);
  return (
    <svg width="28" height="90" viewBox="0 0 28 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`thermo${temperature}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="80%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <clipPath id={`clip${temperature}`}>
          <rect x="9" y={70 - pct * 0.58} width="10" height={pct * 0.58 + 12} rx="5" />
        </clipPath>
      </defs>
      {/* Tube outline */}
      <rect x="9" y="8" width="10" height="62" rx="5" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      {/* Mercury fill */}
      <rect
        x="9" y={70 - pct * 0.58} width="10" height={pct * 0.58 + 12} rx="5"
        fill={`url(#thermo${temperature})`}
        style={{ transition: "all 0.6s ease" }}
      />
      {/* Bulb */}
      <circle cx="14" cy="76" r="9" fill={color} style={{ transition: "fill 0.6s ease" }} />
      <circle cx="14" cy="76" r="5" fill="rgba(255,255,255,0.2)" />
      {/* Tick marks */}
      {[0, 25, 50, 75, 100].map((p) => (
        <line key={p} x1="19" y1={8 + (1 - p / 100) * 60} x2="22" y2={8 + (1 - p / 100) * 60} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
      ))}
    </svg>
  );
}

export function KnowledgePool() {
  const [sks, setSks] = useState<SpecificKnowledge[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemp, setNewTemp] = useState(5);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTemp, setEditTemp] = useState(5);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.listSKs().then(setSks).catch((e) => setError(String(e)));
  useEffect(() => { load(); }, []);

  const filtered = sks.filter((sk) => {
    if (filter === "hot") return sk.temperature >= 7;
    if (filter === "warm") return sk.temperature >= 4 && sk.temperature < 7;
    if (filter === "cold") return sk.temperature < 4;
    return true;
  });

  const addSK = async () => {
    if (!newName.trim()) return;
    await api.createSK({ name: newName.trim(), temperature: newTemp });
    setNewName(""); setNewTemp(5); setAdding(false);
    load();
  };

  const saveEdit = async (id: number) => {
    await api.updateSK(id, { name: editName, temperature: editTemp });
    setEditId(null);
    load();
  };

  const del = async (id: number) => {
    await api.deleteSK(id);
    load();
  };

  const filters: { key: Filter; label: string; color: string }[] = [
    { key: "all", label: "All", color: "#94a3b8" },
    { key: "hot", label: "Hot (7-10)", color: "#f97316" },
    { key: "warm", label: "Warm (4-6)", color: "#14b8a6" },
    { key: "cold", label: "Cold (1-3)", color: "#3b82f6" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Pool"
        subtitle="Every specific knowledge you have assigned to tasks — rated by temperature."
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
        <div className="flex flex-wrap gap-3 items-end p-4 rounded-xl border border-emerald-500/30 bg-slate-900/60">
          <div className="flex-1 min-w-48">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">Name</label>
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
            <label className="text-[10px] text-slate-400 uppercase tracking-wider">
              Temperature: <span style={{ color: tempColor(newTemp) }}>{newTemp}</span>
            </label>
            <input
              type="range" min={1} max={10} value={newTemp}
              onChange={(e) => setNewTemp(Number(e.target.value))}
              className="w-32 mt-1 block accent-emerald-500"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addSK} className="btn-primary text-sm">Save</button>
            <button onClick={() => setAdding(false)} className="text-sm text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        </div>
      )}

      {/* SK grid */}
      {filtered.length === 0 ? (
        <p className="text-slate-500 text-sm italic">
          {sks.length === 0
            ? "No specific knowledge yet. Assign SKs to tasks to populate this pool."
            : "No SKs in this temperature range."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sk) => {
            const color = tempColor(sk.temperature);
            const isEditing = editId === sk.id;
            return (
              <div
                key={sk.id}
                className="rounded-xl border bg-slate-900/70 p-4 flex gap-3 items-start"
                style={{ borderColor: `${color}33` }}
              >
                <div className="shrink-0 mt-1">
                  <Thermometer temperature={sk.temperature} />
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="input-base w-full text-sm"
                      />
                      <div>
                        <span className="text-[10px] text-slate-400">
                          Temperature: <span style={{ color: tempColor(editTemp) }}>{editTemp}</span>
                        </span>
                        <input
                          type="range" min={1} max={10} value={editTemp}
                          onChange={(e) => setEditTemp(Number(e.target.value))}
                          className="w-full accent-emerald-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(sk.id)} className="btn-primary text-xs py-1">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-slate-500">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-slate-100 leading-tight">{sk.name}</span>
                        {sk.in_universe && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 shrink-0">
                            In Universe
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color, background: `${color}18`, border: `1px solid ${color}44` }}
                        >
                          T{sk.temperature} · {tempLabel(sk.temperature)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {sk.task_count} task{sk.task_count !== 1 ? "s" : ""}
                          {sk.completed_count > 0 && ` · ${sk.completed_count} done`}
                        </span>
                      </div>
                      {sk.ai_justification && (
                        <p className="text-[10px] text-slate-500 mt-1.5 leading-snug line-clamp-2">
                          {sk.ai_justification}
                        </p>
                      )}
                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => { setEditId(sk.id); setEditName(sk.name); setEditTemp(sk.temperature); }}
                          className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => del(sk.id)}
                          className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
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
