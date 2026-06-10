import { useEffect, useState } from "react";
import { api } from "../api";
import type { TodayView } from "../types";
import { Card, Empty, StatusBadge } from "../components/ui";

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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Today · {data.day}</h1>

      <Card title="Today's focus">
        {data.focus_system ? (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{data.focus_system.name}</span>
              <span className="text-xs text-slate-400">
                priority {data.focus_system.current_priority ?? "—"}
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {data.focus_tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                  />
                  <span className="flex-1">{t.title}</span>
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

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Upcoming deadlines (next 7 days)">
          <ul className="space-y-2">
            {data.upcoming_deadlines.map((t) => (
              <li key={t.id} className="flex justify-between text-sm">
                <span>{t.title}</span>
                <span className="text-slate-400">{t.deadline}</span>
              </li>
            ))}
            {data.upcoming_deadlines.length === 0 && <Empty>Nothing due soon.</Empty>}
          </ul>
        </Card>

        <Card title="Flagged (overdue or blocked)">
          <ul className="space-y-2">
            {data.flagged.map((t) => (
              <li key={t.id} className="flex justify-between text-sm">
                <span>{t.title}</span>
                <StatusBadge status={t.status} />
              </li>
            ))}
            {data.flagged.length === 0 && <Empty>Nothing flagged.</Empty>}
          </ul>
        </Card>
      </div>

      <Card title="End-of-day check-in">
        <p className="text-sm text-slate-400 mb-2">
          Tick what you completed above, add a note, and close the loop.
        </p>
        <textarea
          className="w-full rounded-md bg-slate-900 border border-slate-700 p-2 text-sm"
          rows={2}
          placeholder="What got done today?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button
          onClick={submitCheckIn}
          disabled={saving}
          className="mt-2 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : `Submit check-in (${selected.size} done)`}
        </button>
      </Card>
    </div>
  );
}
