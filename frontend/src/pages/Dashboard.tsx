import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { TodayView } from "../types";
import { Card, Empty, PageHeader, StatusBadge } from "../components/ui";
import { PriorityBadge } from "../components/WorkItemEditor";
import type { Task } from "../types";

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
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                style={{ color: "var(--color-signal-crit)", border: "1px solid var(--color-signal-crit)", background: "rgba(8,12,24,0.6)" }}
              >
                P{Math.min(...data.focus_tasks.map((t) => t.priority))} — highest priority
              </span>
              <span className="text-[11px] text-slate-500">
                Todo &amp; In Progress across all active systems
              </span>
            </div>
            <ul className="space-y-2.5">
              {data.focus_tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-900/50 border border-slate-800 transition-colors hover:border-slate-700 group"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 rounded accent-emerald-500 shrink-0"
                  />
                  <PriorityBadge priority={t.priority} />
                  <Link
                    to={taskLink(t)}
                    className={`flex-1 text-sm group-hover:text-emerald-300 transition-colors ${selected.has(t.id) ? "line-through text-slate-500" : ""}`}
                  >
                    {t.title}
                    {t.flagged && <span title="Flagged: needs attention" className="ml-1.5">🚩</span>}
                  </Link>
                  {t.system_name && (
                    <span className="text-[10px] text-slate-500 hidden sm:inline whitespace-nowrap">{t.system_name}</span>
                  )}
                  {t.deadline && (
                    <span className="text-xs text-slate-400 whitespace-nowrap">{t.deadline}</span>
                  )}
                  <StatusBadge status={t.status} />
                  <Link
                    to={taskLink(t)}
                    className="text-[10px] text-slate-600 hover:text-emerald-400 transition-colors whitespace-nowrap"
                    title="Open in Systems"
                  >
                    →
                  </Link>
                </li>
              ))}
            </ul>
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
