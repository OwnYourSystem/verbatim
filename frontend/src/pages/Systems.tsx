import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { api } from "../api";
import type { Subtask, System, Task, WorkItemInput } from "../types";
import { Card, Empty, PageHeader, StatusBadge } from "../components/ui";
import { HoursBar, PriorityBadge, WorkItemEditor } from "../components/WorkItemEditor";
import { IconPicker, suggestIcon } from "../components/SystemIcon";

export function Systems() {
  const [systems, setSystems] = useState<System[]>([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🗂️");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // Capture deep-link params once on mount; cleared immediately so back-nav is clean
  const [targetTaskId] = useState<number | null>(() => {
    const t = searchParams.get("task");
    return t ? Number(t) : null;
  });
  const [linkedSystemId] = useState<number | null>(() => {
    const o = searchParams.get("open");
    return o ? Number(o) : null;
  });

  const load = () =>
    api.listSystems().then(setSystems).catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  // Deep-link support: ?open=SYSTEM_ID&task=TASK_ID
  useEffect(() => {
    if (linkedSystemId) {
      setOpenId(linkedSystemId);
      setSearchParams({}, { replace: true });
    }
  }, []);

  const addSystem = async () => {
    if (!name.trim()) return;
    await api.createSystem({ name: name.trim(), icon });
    setName("");
    setIcon("🗂️");
    load();
  };

  const now = new Date();
  const setPriority = async (s: System, score: number) => {
    await api.setPriority(s.id, now.getFullYear(), now.getMonth() + 1, score);
    load();
  };

  const rebalance = async (s: System) => {
    setNotice(null);
    try {
      await api.requestRebalance(s.id);
      setNotice(`The scrum master reviewed “${s.name}”. Review the plan on Proposals.`);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Systems"
        subtitle="Your top-level work domains. Every task & subtask attribute is editable."
      />
      {error && <p className="text-amber-400 text-sm">{error}</p>}
      {notice && (
        <p className="animate-fade-up text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
          {notice}
        </p>
      )}

      <Card title="Add a system">
        <div className="flex gap-2 items-center">
          <IconPicker value={icon} onChange={setIcon} />
          <input
            className="input-base flex-1"
            placeholder="e.g. SAP Datasphere CLI"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIcon(suggestIcon(e.target.value));
            }}
            onKeyDown={(e) => e.key === "Enter" && addSystem()}
          />
          <button onClick={addSystem} className="btn-primary">
            Add
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Icon auto-suggests as you type — click it to change.
        </p>
      </Card>

      <div className="space-y-4">
        {systems.map((s) => (
          <Card key={s.id}>
            <div className="flex items-center gap-3">
              <IconPicker
                value={s.icon ?? suggestIcon(s.name)}
                onChange={(newIcon) => {
                  api.updateSystem(s.id, { icon: newIcon }).then(load);
                }}
              />
              {editingNameId === s.id ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <span className="text-slate-500 mr-1.5">{openId === s.id ? "▾" : "▸"}</span>
                  <input
                    className="input-base flex-1 !py-1 font-semibold"
                    value={editingNameValue}
                    autoFocus
                    onChange={(e) => setEditingNameValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        const trimmed = editingNameValue.trim();
                        if (trimmed) { await api.updateSystem(s.id, { name: trimmed }); load(); }
                        setEditingNameId(null);
                      } else if (e.key === "Escape") {
                        setEditingNameId(null);
                      }
                    }}
                  />
                  <button
                    className="btn-secondary !px-2 !py-1 !text-xs"
                    onClick={async () => {
                      const trimmed = editingNameValue.trim();
                      if (trimmed) { await api.updateSystem(s.id, { name: trimmed }); load(); }
                      setEditingNameId(null);
                    }}
                  >
                    Save
                  </button>
                  <button
                    className="btn-ghost-danger !px-2 !py-1"
                    onClick={() => setEditingNameId(null)}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <button
                    onClick={() => setOpenId(openId === s.id ? null : s.id)}
                    className="font-semibold flex-1 text-left transition-colors hover:text-emerald-300 min-w-0"
                  >
                    <span className="text-slate-500 mr-1.5">{openId === s.id ? "▾" : "▸"}</span>
                    {s.name}
                  </button>
                  <button
                    onClick={() => { setEditingNameId(s.id); setEditingNameValue(s.name); }}
                    className="text-slate-500 hover:text-emerald-400 transition-colors text-sm shrink-0"
                    title="Rename system"
                  >
                    ✎
                  </button>
                </div>
              )}
              <label className="text-xs text-slate-400">monthly priority</label>
              <input
                type="number"
                min={1}
                max={100}
                defaultValue={s.current_priority ?? ""}
                onBlur={(e) => e.target.value && setPriority(s, Number(e.target.value))}
                className="input-base w-16 !py-1"
              />
              <button
                onClick={() => rebalance(s)}
                className="btn-accent !px-3 !py-1.5 !text-xs"
                title="Ask the AI scrum master to review and plan this system"
              >
                Scrum review
              </button>
              <button
                onClick={async () => {
                  await api.deleteSystem(s.id);
                  load();
                }}
                className="btn-ghost-danger"
              >
                delete
              </button>
            </div>
            {openId === s.id && (
              <TaskManager
                systemId={s.id}
                targetTaskId={s.id === linkedSystemId ? targetTaskId : null}
              />
            )}
          </Card>
        ))}
        {systems.length === 0 && <Empty>No systems yet. Add one above.</Empty>}
      </div>
    </div>
  );
}

function TaskManager({ systemId, targetTaskId }: { systemId: number; targetTaskId: number | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [hours, setHours] = useState("");
  const [priority, setPriority] = useState("3");

  const load = () => api.listTasks(systemId).then(setTasks);
  useEffect(() => {
    load();
  }, [systemId]);

  const addTask = async () => {
    if (!title.trim()) return;
    await api.createTask({
      system_id: systemId,
      title: title.trim(),
      deadline: deadline || null,
      dedicated_hours: hours ? Number(hours) : 0,
      priority: Number(priority),
    });
    setTitle("");
    setDeadline("");
    setHours("");
    setPriority("3");
    load();
  };

  return (
    <div className="mt-4 pl-4 border-l-2 border-emerald-500/20 space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="input-base flex-1 min-w-[160px] !py-1.5"
          placeholder="New task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
        />
        <select
          className="input-base !py-1.5"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          title="Priority (1 = highest)"
        >
          {[1, 2, 3, 4, 5].map((p) => (
            <option key={p} value={p}>
              P{p}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step={0.5}
          placeholder="hrs"
          className="input-base w-20 !py-1.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
        />
        <input
          type="date"
          className="input-base !py-1.5"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <button onClick={addTask} className="btn-secondary !px-3 !py-1.5">
          Add
        </button>
      </div>
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} onChange={load} highlight={t.id === targetTaskId} />
      ))}
      {tasks.length === 0 && (
        <p className="text-xs text-slate-500">No tasks yet — add one above.</p>
      )}
    </div>
  );
}

function TaskRow({ task, onChange, highlight = false }: { task: Task; onChange: () => void; highlight?: boolean }) {
  const [open, setOpen] = useState(highlight); // auto-open if deep-linked
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlight && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlight]);

  const save = async (patch: WorkItemInput) => {
    await api.updateTask(task.id, patch);
    onChange();
  };
  const logTime = async (h: number, note: string | null) => {
    await api.logTime({ task_id: task.id, hours: h, note });
    onChange();
  };

  return (
    <div
      ref={rowRef}
      className={`rounded-xl border bg-slate-900/30 transition-all duration-700 ${
        highlight ? "border-emerald-500/60 shadow-[0_0_12px_rgba(52,211,153,0.15)]" : "border-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 text-sm px-2.5 py-2">
        <button onClick={() => setOpen(!open)} className="text-slate-500">
          {open ? "▾" : "▸"}
        </button>
        <PriorityBadge priority={task.priority} />
        <button onClick={() => setOpen(!open)} className="flex-1 text-left font-medium">
          {task.title}
          {task.data_exposure_concern && <span title="Data exposure" className="ml-1.5">🔒</span>}
          {task.required_demo && <span title="Demo required" className="ml-1">🎬</span>}
        </button>
        {task.last_checkpoint && (
          <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
            {task.last_checkpoint}
          </span>
        )}
        <div className="hidden sm:block w-32">
          <HoursBar spent={task.spent_hours} dedicated={task.dedicated_hours} />
        </div>
        <StatusBadge status={task.status} />
        <button
          onClick={async () => {
            await api.deleteTask(task.id);
            onChange();
          }}
          className="btn-ghost-danger"
        >
          ✕
        </button>
      </div>
      {open && (
        <div className="px-2.5 pb-3 space-y-3">
          <WorkItemEditor item={task} onSave={save} onLogTime={logTime} />
          <SubtaskManager taskId={task.id} />
        </div>
      )}
    </div>
  );
}

function SubtaskManager({ taskId }: { taskId: number }) {
  const [subs, setSubs] = useState<Subtask[]>([]);
  const [title, setTitle] = useState("");

  const load = () => api.listSubtasks(taskId).then(setSubs);
  useEffect(() => {
    load();
  }, [taskId]);

  const add = async () => {
    if (!title.trim()) return;
    await api.createSubtask({ task_id: taskId, title: title.trim() });
    setTitle("");
    load();
  };

  return (
    <div className="pl-3 border-l border-slate-800 space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Subtasks
      </div>
      {subs.map((st) => (
        <SubtaskRow key={st.id} sub={st} onChange={load} />
      ))}
      <div className="flex gap-2 pt-1">
        <input
          className="input-base flex-1 !py-1"
          placeholder="New subtask"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button onClick={add} className="btn-secondary !px-3 !py-1">
          Add
        </button>
      </div>
    </div>
  );
}

function SubtaskRow({ sub, onChange }: { sub: Subtask; onChange: () => void }) {
  const [open, setOpen] = useState(false);

  const save = async (patch: WorkItemInput) => {
    await api.updateSubtask(sub.id, patch);
    onChange();
  };
  const logTime = async (h: number, note: string | null) => {
    await api.logTime({ subtask_id: sub.id, hours: h, note });
    onChange();
  };

  return (
    <div className="rounded-lg border border-slate-800/70">
      <div className="flex items-center gap-2 text-sm px-2 py-1.5">
        <button onClick={() => setOpen(!open)} className="text-slate-500">
          {open ? "▾" : "▸"}
        </button>
        <PriorityBadge priority={sub.priority} />
        <button onClick={() => setOpen(!open)} className="flex-1 text-left">
          {sub.title}
        </button>
        <span className="text-[10px] text-slate-500">
          inh. {sub.inherited_priority ?? "—"}
        </span>
        <StatusBadge status={sub.status} />
        <button
          onClick={async () => {
            await api.deleteSubtask(sub.id);
            onChange();
          }}
          className="btn-ghost-danger"
        >
          ✕
        </button>
      </div>
      {open && (
        <div className="px-2 pb-2">
          <WorkItemEditor item={sub} onSave={save} onLogTime={logTime} />
        </div>
      )}
    </div>
  );
}
