import { useEffect, useState } from "react";
import { api } from "../api";
import type { FocusBlock, System } from "../types";
import { Card, Empty } from "../components/ui";

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Calendar</h1>
      {error && <p className="text-amber-400 text-sm">{error}</p>}

      <Card title="Add a focus block">
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="rounded-md bg-slate-900 border border-slate-700 p-2 text-sm"
          />
          <select
            value={systemId}
            onChange={(e) =>
              setSystemId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="rounded-md bg-slate-900 border border-slate-700 p-2 text-sm"
          >
            <option value="">(no system)</option>
            {systems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded-md bg-slate-900 border border-slate-700 p-2 text-sm"
            placeholder="Note (e.g. deep work)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button
            onClick={add}
            className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-sm font-medium"
          >
            Add
          </button>
        </div>
      </Card>

      <Card title="Agenda">
        {Object.keys(byDay).length === 0 && <Empty>No focus blocks scheduled.</Empty>}
        <div className="space-y-3">
          {Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([d, items]) => (
              <div key={d}>
                <div className="text-sm font-medium text-slate-300">{d}</div>
                <ul className="mt-1 space-y-1">
                  {items.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400">{systemName(b.system_id)}</span>
                      <span className="flex-1">{b.note}</span>
                      <button
                        onClick={async () => {
                          await api.deleteFocusBlock(b.id);
                          load();
                        }}
                        className="text-xs text-slate-500 hover:text-red-400"
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
