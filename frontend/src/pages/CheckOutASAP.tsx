import { useEffect, useState } from "react";
import { api } from "../api";
import type { ReadingItem } from "../types";
import { PageHeader } from "../components/ui";

function groupByMonth(items: ReadingItem[]): [string, ReadingItem[]][] {
  const map = new Map<string, ReadingItem[]>();
  items.forEach((item) => {
    const d = new Date(item.checked_at ?? item.created_at);
    const key = d.toLocaleString("default", { month: "long", year: "numeric" });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  });
  return [...map.entries()];
}

function shorten(url: string) {
  try {
    const u = new URL(url);
    return u.hostname + (u.pathname.length > 20 ? u.pathname.slice(0, 20) + "…" : u.pathname);
  } catch {
    return url.length > 40 ? url.slice(0, 40) + "…" : url;
  }
}

export function CheckOutASAP() {
  const [active, setActive] = useState<ReadingItem[]>([]);
  const [archived, setArchived] = useState<ReadingItem[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [showArchive, setShowArchive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [a, ar] = await Promise.all([
      api.listReadingItems(false),
      api.listReadingItems(true),
    ]);
    setActive(a);
    setArchived(ar);
  };

  useEffect(() => { load().catch((e) => setError(String(e))); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.createReadingItem({ title: title.trim(), url: url.trim() || undefined, description: desc.trim() || undefined });
    setTitle(""); setUrl(""); setDesc("");
    load();
  };

  const check = async (id: number) => {
    await api.checkReadingItem(id);
    load();
  };

  const del = async (id: number) => {
    await api.deleteReadingItem(id);
    load();
  };

  const groups = groupByMonth(archived);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Check Out ASAP"
        subtitle="Save links and topics to study later. Check them off when done."
      />

      {error && <p className="text-amber-400 text-sm">{error}</p>}

      {/* Add form */}
      <form onSubmit={add} className="space-y-3 p-4 rounded-xl border border-slate-700/60 bg-slate-900/60">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What to check out…"
            className="input-base flex-1"
          />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (optional)"
            className="input-base flex-1"
          />
        </div>
        <div className="flex gap-3">
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Short description (optional)"
            className="input-base flex-1"
          />
          <button type="submit" className="btn-primary shrink-0">Add</button>
        </div>
      </form>

      {/* Active items */}
      {active.length === 0 ? (
        <p className="text-slate-500 text-sm italic">Nothing queued — add something above.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-900/50 group"
            >
              <button
                onClick={() => check(item.id)}
                title="Mark as done"
                className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 border-slate-600 hover:border-emerald-400 transition-colors flex items-center justify-center"
              >
                <span className="text-emerald-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">✓</span>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-sm text-white hover:text-emerald-300 transition-colors"
                    >
                      {item.title}
                    </a>
                  ) : (
                    <span className="font-semibold text-sm text-white">{item.title}</span>
                  )}
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors truncate max-w-xs"
                    >
                      {shorten(item.url)}
                    </a>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                )}
              </div>
              <button
                onClick={() => del(item.id)}
                className="shrink-0 text-[10px] text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Archive toggle */}
      {archived.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchive((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
          >
            <span>{showArchive ? "▾" : "▸"}</span>
            Archive ({archived.length} item{archived.length !== 1 ? "s" : ""})
          </button>

          {showArchive && (
            <div className="mt-3 space-y-4">
              {groups.map(([month, items]) => (
                <div key={month}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">{month}</p>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-xs text-slate-500 group">
                        <span className="text-emerald-700 shrink-0">✓</span>
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex-1 hover:text-slate-300 transition-colors line-through decoration-slate-600">
                            {item.title}
                          </a>
                        ) : (
                          <span className="flex-1 line-through decoration-slate-600">{item.title}</span>
                        )}
                        <span className="text-slate-700 shrink-0">
                          {item.checked_at ? new Date(item.checked_at).toLocaleDateString() : ""}
                        </span>
                        <button onClick={() => del(item.id)} className="text-slate-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
