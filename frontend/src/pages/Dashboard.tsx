import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Subtask, Task, TodayView } from "../types";
import { Card, Empty, PageHeader, StatusBadge } from "../components/ui";
import { PriorityBadge } from "../components/WorkItemEditor";

/** URL that deep-links to a specific task inside the Systems page. */
function taskLink(t: Task) {
  return `/systems?open=${t.system_id}&task=${t.id}`;
}

/** Why a task landed in the Flagged panel: 🚩 manual flag, overdue, or blocked. */
function FlagReasons({ task }: { task: Task }) {
  const reasons: { label: string; color: string }[] = [];
  if (task.flagged) reasons.push({ label: "🚩 flagged", color: "var(--color-signal-warn)" });
  if (task.time_left_days != null && task.time_left_days < 0)
    reasons.push({
      label: `${Math.abs(task.time_left_days)}d overdue`,
      color: "var(--color-signal-crit)",
    });
  if (task.status === "blocked")
    reasons.push({ label: "blocked", color: "var(--color-signal-crit)" });
  return (
    <span className="flex gap-1.5">
      {reasons.map((r) => (
        <span
          key={r.label}
          className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ color: r.color, border: `1px solid ${r.color}`, background: "rgba(8,12,24,0.5)" }}
        >
          {r.label}
        </span>
      ))}
    </span>
  );
}

export function Dashboard() {
  const [data, setData] = useState<TodayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    api
      .today()
      .then(setData)
      .catch((e) => setError(String(e)));
  };

  useEffect(load, []);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const submitCheckIn = async () => {
    setSaving(true);
    try {
      await api.createCheckIn({ notes, completed_task_ids: [...selected] });
      setSelected(new Set());
      setNotes("");
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-amber-400 text-sm">{error}</p>;
  if (!data) return <p className="text-slate-400 text-sm">Loading…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Today <span className="text-slate-600 font-medium">·</span> <span className="text-gradient">{data.day}</span></>}
        subtitle="Your single point of focus for the day."
      />

      <Card title="Today's focus">
        {data.focus_tasks.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                style={{ color: "var(--color-signal-crit)", border: "1px solid var(--color-signal-crit)", background: "rgba(8,12,24,0.6)" }}
              >
                P{Math.min(...data.focus_tasks.map((t) => t.priority))} — highest priority
              </span>
              <span className="text-[11px] text-slate-500">
                Pick a card, get it done.
              </span>
            </div>
            {/* Sticky-note wall */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.focus_tasks.map((t, idx) => {
                const subtasks = data.focus_subtasks.filter((st: Subtask) => st.task_id === t.id);
                const done = selected.has(t.id);
                /* Rotate alternates slightly for a pinboard feel */
                const rotate = ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[0.5deg]"][idx % 4];
                /* Accent colours cycle through warm sticky-note hues */
                const accent = [
                  { bg: "#fef08a", text: "#713f12" },   // yellow
                  { bg: "#bbf7d0", text: "#14532d" },   // mint
                  { bg: "#fed7aa", text: "#7c2d12" },   // peach
                  { bg: "#c7d2fe", text: "#312e81" },   // lavender
                  { bg: "#fecdd3", text: "#881337" },   // rose
                ][idx % 5];

                return (
                  <div
                    key={t.id}
                    className={`relative flex flex-col rounded-sm shadow-xl transition-transform duration-200 hover:scale-[1.03] hover:z-10 cursor-default ${rotate} ${done ? "opacity-50" : ""}`}
                    style={{
                      background: accent.bg,
                      boxShadow: "4px 4px 10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.3)",
                      minHeight: "160px",
                    }}
                  >
                    {/* Tape strip at top */}
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 w-10 h-6 rounded-sm opacity-60"
                      style={{ background: "rgba(255,255,255,0.55)", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }}
                    />

                    <div className="p-4 pt-5 flex flex-col gap-2 flex-1">
                      {/* System badge */}
                      {t.system_name && (
                        <span
                          className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded self-start"
                          style={{ background: "rgba(0,0,0,0.12)", color: accent.text }}
                        >
                          {t.system_name}
                        </span>
                      )}

                      {/* Task title + checkbox */}
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() => toggle(t.id)}
                          className="mt-0.5 h-4 w-4 rounded shrink-0 accent-emerald-600"
                        />
                        <Link
                          to={taskLink(t)}
                          className={`text-sm font-bold leading-snug transition-colors hover:underline ${done ? "line-through opacity-50" : ""}`}
                          style={{ color: accent.text }}
                        >
                          {t.title}
                          {t.flagged && <span className="ml-1 text-red-600">!</span>}
                        </Link>
                      </label>

                      {/* Priority + status + deadline row */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                        {t.deadline && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: "rgba(0,0,0,0.1)", color: accent.text }}
                          >
                            {t.deadline}
                          </span>
                        )}
                      </div>

                      {/* Subtasks */}
                      {subtasks.length > 0 && (
                        <ul className="mt-1 space-y-1 border-t pt-2" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
                          {subtasks.map((st: Subtask) => (
                            <li key={st.id} className="flex items-start gap-1.5 text-xs" style={{ color: accent.text }}>
                              <span className="mt-0.5 shrink-0 opacity-60">↳</span>
                              <Link
                                to={`/systems?open=${t.system_id}&task=${t.id}`}
                                className="flex-1 leading-snug hover:underline opacity-80 hover:opacity-100"
                              >
                                {st.title}
                                {st.flagged && <span className="ml-1 text-red-600">!</span>}
                              </Link>
                              <StatusBadge status={st.status} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Bottom-right open link */}
                    <Link
                      to={taskLink(t)}
                      className="self-end px-3 pb-2 text-[10px] opacity-40 hover:opacity-80 transition-opacity"
                      style={{ color: accent.text }}
                      title="Open in Systems"
                    >
                      open →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Empty>
            No P1 tasks in Todo or In Progress. Set a task's priority to P1 to see it here.
          </Empty>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Upcoming deadlines (next 7 days)">
          <ul className="space-y-2.5">
            {data.upcoming_deadlines.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm group">
                <Link to={taskLink(t)} className="flex-1 group-hover:text-emerald-300 transition-colors">
                  {t.title}
                </Link>
                {t.system_name && (
                  <span className="text-[10px] text-slate-500 hidden sm:inline">{t.system_name}</span>
                )}
                <span className="text-xs font-medium text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5 whitespace-nowrap">
                  {t.deadline}
                </span>
                <Link to={taskLink(t)} className="text-[10px] text-slate-600 hover:text-emerald-400 transition-colors" title="Open in Systems">→</Link>
              </li>
            ))}
            {data.upcoming_deadlines.length === 0 && <Empty>Nothing due soon.</Empty>}
          </ul>
        </Card>

        <Card title="Flagged (🚩 raised, overdue or blocked)">
          <ul className="space-y-2.5">
            {data.flagged.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm group">
                <PriorityBadge priority={t.priority} />
                <Link to={taskLink(t)} className="flex-1 group-hover:text-emerald-300 transition-colors">{t.title}</Link>
                <FlagReasons task={t} />
                <StatusBadge status={t.status} />
                <Link to={taskLink(t)} className="text-[10px] text-slate-600 hover:text-emerald-400 transition-colors" title="Open in Systems">→</Link>
              </li>
            ))}
            {data.flagged.length === 0 && <Empty>Nothing flagged.</Empty>}
          </ul>
        </Card>
      </div>

      <Card title="End-of-day check-in">
        <p className="text-sm text-slate-400 mb-3">
          Tick what you completed above, add a note, and close the loop.
        </p>
        <textarea
          className="input-base w-full"
          rows={2}
          placeholder="What got done today?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button onClick={submitCheckIn} disabled={saving} className="btn-primary mt-3">
          {saving ? "Saving…" : `Submit check-in (${selected.size} done)`}
        </button>
      </Card>
    </div>
  );
}
