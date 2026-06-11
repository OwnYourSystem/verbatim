import { useEffect, useState } from "react";
import { api } from "../api";
import type { FocusBlock, System } from "../types";
import { Card, Empty, PageHeader } from "../components/ui";

export function Calendar() {
  const [blocks, setBlocks] = useState<FocusBlock[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [systemId, setSystemId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api.listFocusBlocks().then(setBlocks).catch((e) => setError(String(e)));
  useEffect(() => {
    load();
    api.listSystems().then(setSystems);
  }, []);

  const add = async () => {
    await api.createFocusBlock({
      day,
      system_id: systemId === "" ? null : Number(systemId),
      note: note || null,
    });
    setNote("");
    load();
  };

  const systemName = (id: number | null) =>
    systems.find((s) => s.id === id)?.name ?? "—";

  // Group blocks by day for a simple agenda view.
  const byDay = blocks.reduce<Record<string, FocusBlock[]>>((acc, b) => {
    (acc[b.day] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="Reserve focus blocks so deep work actually happens."
      />
      {error && <p className="text-amber-400 text-sm">{error}</p>}

      <Card title="Add a focus block">
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="input-base"
          />
          <select
            value={systemId}
            onChange={(e) =>
              setSystemId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="input-base"
          >
            <option value="">(no system)</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            className="input-base flex-1"
            placeholder="Note (e.g. deep work)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button onClick={add} className="btn-primary">
            Add
          </button>
        </div>
      </Card>

      <Card title="Agenda">
        {Object.keys(byDay).length === 0 && <Empty>No focus blocks scheduled.</Empty>}
        <div className="space-y-4">
          {Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([d, items]) => (
              <div key={d} className="relative pl-5">
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow shadow-emerald-500/40"
                />
                <div className="text-sm font-semibold text-slate-200">{d}</div>
                <ul className="mt-1.5 space-y-1.5">
                  {items.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-slate-900/50 border border-slate-800 transition-colors hover:border-slate-700"
                    >
                      <span className="text-emerald-300/80 text-xs font-medium">
                        {systemName(b.system_id)}
                      </span>
                      <span className="flex-1">{b.note}</span>
                      <button
                        onClick={async () => {
                          await api.deleteFocusBlock(b.id);
                          load();
                        }}
                        className="btn-ghost-danger"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}
