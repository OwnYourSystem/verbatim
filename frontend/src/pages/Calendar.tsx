import { useEffect, useState } from "react";
import { api } from "../api";
import type { FocusBlock, System, Task } from "../types";
import { Card, Empty, PageHeader } from "../components/ui";

export function Calendar() {
  const [blocks, setBlocks] = useState<FocusBlock[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [systemId, setSystemId] = useState<number | "">("");
  const [taskId, setTaskId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api.listFocusBlocks().then(setBlocks).catch((e) => setError(String(e)));
  useEffect(() => {
    load();
    api.listSystems().then(setSystems);
  }, []);

  // Load tasks for the chosen system so they can be scheduled directly.
  useEffect(() => {
    if (systemId === "") {
      setTasks([]);
      setTaskId("");
      return;
    }
    api.listTasks(Number(systemId)).then(setTasks);
  }, [systemId]);

  const add = async () => {
    await api.createFocusBlock({
      day,
      system_id: systemId === "" ? null : Number(systemId),
      task_id: taskId === "" ? null : Number(taskId),
      note: note || null,
    });
    setNote("");
    setTaskId("");
    load();
  };

  const byDay = blocks.reduce<Record<string, FocusBlock[]>>((acc, b) => {
    (acc[b.day] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle="Schedule systems, tasks and subtasks. New dated tasks land here automatically."
      />
      {error && <p className="text-amber-400 text-sm">{error}</p>}

      <Card title="Schedule a block">
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
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value === "" ? "" : Number(e.target.value))}
            className="input-base"
            disabled={systemId === ""}
            title={systemId === "" ? "Pick a system first" : "Link a task"}
          >
            <option value="">(no task)</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <input
            className="input-base flex-1 min-w-[140px]"
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
                      {b.system_name && (
                        <span className="text-emerald-300/80 text-xs font-medium whitespace-nowrap">
                          {b.system_name}
                        </span>
                      )}
                      {b.task_title && (
                        <span className="text-violet-300/90 text-xs px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 whitespace-nowrap">
                          {b.task_title}
                        </span>
                      )}
                      <span className="flex-1 text-slate-300">{b.note}</span>
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
