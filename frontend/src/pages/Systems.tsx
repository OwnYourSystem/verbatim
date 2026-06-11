import { useEffect, useState } from "react";
import { api } from "../api";
import type { Subtask, System, Task } from "../types";
import { Card, Empty, PageHeader, StatusBadge } from "../components/ui";

export function Systems() {
  const [systems, setSystems] = useState<System[]>([]);
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () =>
    api.listSystems().then(setSystems).catch((e) => setError(String(e)));
  useEffect(() => {
    load();
  }, []);

  const addSystem = async () => {
    if (!name.trim()) return;
    await api.createSystem({ name: name.trim() });
    setName("");
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
      setNotice(`Agent proposed a rebalance for “${s.name}”. Review it on Proposals.`);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Systems"
        subtitle="Your top-level work domains, each with its own priority and agent."
      />
      {error && <p className="text-amber-400 text-sm">{error}</p>}
      {notice && (
        <p className="animate-fade-up text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3">
          {notice}
        </p>
      )}

      <Card title="Add a system">
        <div className="flex gap-2">
          <input
            className="input-base flex-1"
            placeholder="e.g. SAP Datasphere CLI"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSystem()}
          />
          <button onClick={addSystem} className="btn-primary">
            Add
          </button>
        </div>
      </Card>

      <div className="space-y-4">
        {systems.map((s) => (
          <Card key={s.id}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setOpenId(openId === s.id ? null : s.id)}
                className="font-semibold flex-1 text-left transition-colors hover:text-emerald-300"
              >
                <span className="text-slate-500 mr-1.5">{openId === s.id ? "▾" : "▸"}</span>
                {s.name}
              </button>
              <label className="text-xs text-slate-400">priority</label>
              <input
                type="number"
                min={1}
                max={100}
                defaultValue={s.current_priority ?? ""}
                onBlur={(e) =>
                  e.target.value && setPriority(s, Number(e.target.value))
                }
                className="input-base w-16 !py-1"
              />
              <button
                onClick={() => rebalance(s)}
                className="btn-accent !px-3 !py-1.5 !text-xs"
                title="Ask this system's agent to propose a rebalance"
              >
                Rebalance
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
            {openId === s.id && <TaskManager systemId={s.id} />}
          </Card>
        ))}
        {systems.length === 0 && <Empty>No systems yet. Add one above.</Empty>}
      </div>
    </div>
  );
}

function TaskManager({ systemId }: { systemId: number }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");

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
    });
    setTitle("");
    setDeadline("");
    load();
  };

  return (
    <div className="mt-4 pl-4 border-l-2 border-emerald-500/20 space-y-3">
      <div className="flex gap-2">
        <input
          className="input-base flex-1 !py-1.5"
          placeholder="New task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
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
        <TaskRow key={t.id} task={t} onChange={load} />
      ))}
    </div>
  );
}

function TaskRow({ task, onChange }: { task: Task; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subTitle, setSubTitle] = useState("");

  const loadSubs = () => api.listSubtasks(task.id).then(setSubtasks);
  useEffect(() => {
    if (open) loadSubs();
  }, [open, task.id]);

  const cycle = async () => {
    const next = task.status === "done" ? "todo" : "done";
    await api.updateTask(task.id, { status: next });
    onChange();
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-900/60">
        <button onClick={() => setOpen(!open)} className="text-slate-500">
          {open ? "▾" : "▸"}
        </button>
        <button onClick={cycle} className="flex-1 text-left">
          {task.title}
        </button>
        {task.deadline && <span className="text-xs text-slate-400">{task.deadline}</span>}
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
        <div className="mt-2 pl-5 border-l border-slate-800 space-y-1">
          {subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{st.title}</span>
              <span className="text-xs text-slate-500">
                inh. priority {st.inherited_priority ?? "—"}
              </span>
              <button
                onClick={async () => {
                  await api.deleteSubtask(st.id);
                  loadSubs();
                }}
                className="btn-ghost-danger"
              >
                ✕
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <input
              className="input-base flex-1 !py-1"
              placeholder="New subtask"
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && subTitle.trim()) {
                  await api.createSubtask({ task_id: task.id, title: subTitle.trim() });
                  setSubTitle("");
                  loadSubs();
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
