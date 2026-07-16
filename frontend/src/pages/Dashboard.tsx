import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Task, TodayView } from "../types";
import { MeCard, MeSectionTitle } from "../components/me/Card";
import { ProgressRing } from "../components/me/ProgressRing";
import { PrimaryButton } from "../components/me/PrimaryButton";
import { DraggableList } from "../components/me/DraggableList";
import { ME_INK, ME_INK_SOFT, pastelFor } from "../components/me/tokens";

/** URL that deep-links to a specific task inside the Systems page. */
function taskLink(t: Task) {
  return `/systems?open=${t.system_id}&task=${t.id}`;
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "crit" }) {
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: "rgba(255,255,255,0.55)", color: tone === "crit" ? "#B4351A" : "inherit" }}
    >
      {children}
    </span>
  );
}

function FlagReasons({ task }: { task: Task }) {
  const reasons: string[] = [];
  if (task.flagged) reasons.push("🚩 flagged");
  if (task.time_left_days != null && task.time_left_days < 0)
    reasons.push(`${Math.abs(task.time_left_days)}d overdue`);
  if (task.status === "blocked") reasons.push("blocked");
  return (
    <span className="flex gap-1.5 flex-wrap">
      {reasons.map((r) => (
        <span
          key={r}
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(255,137,100,0.14)", color: "#B4351A" }}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

function coachLine(done: number, total: number): string {
  if (total === 0) return "No must-do tasks today — a calm one. 🌿";
  if (done === 0) return "Let's get one thing moving.";
  if (done === total) return "Every focus task done — nice work today! 🎉";
  return `${done} of ${total} done — keep the momentum going.`;
}

export function Dashboard() {
  const [data, setData] = useState<TodayView | null>(null);
  const [order, setOrder] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    api
      .today()
      .then((d) => {
        setData(d);
        setOrder(d.focus_tasks);
      })
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

  const reorderFocus = async (next: Task[]) => {
    setOrder(next);
    // Persist the new manual order via each task's `position` — the backend
    // sorts focus tasks by (position, deadline), so a drag here sticks.
    try {
      await Promise.all(next.map((t, i) => api.updateTask(t.id, { position: (i + 1) * 10 })));
    } catch (e) {
      setError(String(e));
    }
  };

  if (error) return <p className="text-amber-700 text-sm">{error}</p>;
  if (!data) return <p className="text-sm" style={{ color: ME_INK_SOFT }}>Loading…</p>;

  const doneCount = order.filter((t) => selected.has(t.id)).length;
  const progressPct = order.length ? (doneCount / order.length) * 100 : 0;

  return (
    <div className="space-y-5 pt-1">
      <MeCard>
        <div className="flex items-center gap-4">
          <ProgressRing value={progressPct} label={`${doneCount}/${order.length}`} />
          <div>
            <MeSectionTitle>Today's focus</MeSectionTitle>
            <p className="text-sm" style={{ color: ME_INK_SOFT }}>
              {coachLine(doneCount, order.length)}
            </p>
          </div>
        </div>
      </MeCard>

      {order.length > 0 ? (
        <DraggableList
          items={order}
          getId={(t) => t.id}
          onReorder={reorderFocus}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          renderItem={(t) => {
            const subtasks = data.focus_subtasks.filter((st) => st.task_id === t.id);
            const done = selected.has(t.id);
            const tint = pastelFor(t.id);
            return (
              <MeCard tint={tint} className={done ? "opacity-60" : ""}>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggle(t.id)}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="mt-1 h-5 w-5 rounded-full shrink-0 accent-current cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={taskLink(t)}
                      onPointerDown={(e) => e.stopPropagation()}
                      className={`text-sm font-bold leading-snug hover:underline ${done ? "line-through opacity-60" : ""}`}
                    >
                      {t.title}
                    </Link>
                    {t.system_name && (
                      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 mt-0.5">
                        {t.system_name}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Chip tone="crit">P{t.priority}</Chip>
                      <Chip>{t.status.replace("_", " ")}</Chip>
                      {t.deadline && <Chip>{t.deadline}</Chip>}
                    </div>
                    {subtasks.length > 0 && (
                      <ul className="mt-2 space-y-1 pt-2 border-t" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
                        {subtasks.map((st) => (
                          <li key={st.id} className="flex items-start gap-1.5 text-xs opacity-80">
                            <span className="shrink-0">↳</span>
                            <Link
                              to={`/systems?open=${t.system_id}&task=${t.id}`}
                              onPointerDown={(e) => e.stopPropagation()}
                              className="flex-1 leading-snug hover:underline"
                            >
                              {st.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </MeCard>
            );
          }}
        />
      ) : (
        <MeCard>
          <p className="text-sm" style={{ color: ME_INK_SOFT }}>
            No P1 tasks in Todo or In Progress. Set a task's priority to P1 to see it here.
          </p>
        </MeCard>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <MeCard>
          <MeSectionTitle>Coming up (7 days)</MeSectionTitle>
          <ul className="space-y-2">
            {data.upcoming_deadlines.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <Link to={taskLink(t)} className="flex-1 truncate hover:underline">
                  {t.title}
                </Link>
                <Chip>{t.deadline}</Chip>
              </li>
            ))}
            {data.upcoming_deadlines.length === 0 && (
              <p className="text-sm" style={{ color: ME_INK_SOFT }}>
                Nothing due soon. 🌤️
              </p>
            )}
          </ul>
        </MeCard>

        <MeCard>
          <MeSectionTitle>Needs attention</MeSectionTitle>
          <ul className="space-y-2">
            {data.flagged.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <Link to={taskLink(t)} className="flex-1 truncate hover:underline">
                  {t.title}
                </Link>
                <FlagReasons task={t} />
              </li>
            ))}
            {data.flagged.length === 0 && (
              <p className="text-sm" style={{ color: ME_INK_SOFT }}>
                Nothing flagged. Clear skies. ☀️
              </p>
            )}
          </ul>
        </MeCard>
      </div>

      <MeCard>
        <MeSectionTitle>End-of-day check-in</MeSectionTitle>
        <p className="text-sm mb-3" style={{ color: ME_INK_SOFT }}>
          Tick what you completed above, jot a note, and close the loop.
        </p>
        <textarea
          className="w-full rounded-2xl px-3 py-2 text-sm resize-none"
          style={{ background: "rgba(60,50,40,0.04)", color: ME_INK, border: "1px solid rgba(60,50,40,0.08)" }}
          rows={2}
          placeholder="What got done today?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="mt-3">
          <PrimaryButton onClick={submitCheckIn} disabled={saving}>
            {saving ? "Saving…" : `Submit check-in (${selected.size} done)`}
          </PrimaryButton>
        </div>
      </MeCard>
    </div>
  );
}
