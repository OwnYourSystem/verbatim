import { useEffect, useState } from "react";
import { api } from "../api";
import type { TodayView } from "../types";
import { Card, Empty, PageHeader, StatusBadge } from "../components/ui";

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
        {data.focus_system ? (
          <div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">{data.focus_system.name}</span>
              <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40">
                priority {data.focus_system.current_priority ?? "—"}
              </span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {data.focus_tasks.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 bg-slate-900/50 border border-slate-800 transition-colors hover:border-slate-700"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="h-4 w-4 rounded accent-emerald-500"
                  />
                  <span className={`flex-1 ${selected.has(t.id) ? "line-through text-slate-500" : ""}`}>
                    {t.title}
                  </span>
                  {t.deadline && (
                    <span className="text-xs text-slate-400">{t.deadline}</span>
                  )}
                  <StatusBadge status={t.status} />
                </li>
              ))}
              {data.focus_tasks.length === 0 && <Empty>No open tasks.</Empty>}
            </ul>
          </div>
        ) : (
          <Empty>
            No focus system yet. Add a system with open tasks and set its priority.
          </Empty>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Upcoming deadlines (next 7 days)">
          <ul className="space-y-2.5">
            {data.upcoming_deadlines.map((t) => (
              <li key={t.id} className="flex justify-between items-center text-sm">
                <span>{t.title}</span>
                <span className="text-xs font-medium text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5">
                  {t.deadline}
                </span>
              </li>
            ))}
            {data.upcoming_deadlines.length === 0 && <Empty>Nothing due soon.</Empty>}
          </ul>
        </Card>

        <Card title="Flagged (overdue or blocked)">
          <ul className="space-y-2.5">
            {data.flagged.map((t) => (
              <li key={t.id} className="flex justify-between items-center text-sm">
                <span>{t.title}</span>
                <StatusBadge status={t.status} />
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
