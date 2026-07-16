import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import {
  CHECKPOINTS,
  type SKRating,
  type SpecificKnowledge,
  type WorkItemFields,
  type WorkItemInput,
  type WorkStatus,
} from "../types";
import { RATINGS, ratingColor, ratingLabel } from "./Thermometer";

const STATUSES: { value: WorkStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

/** Priority 1 (highest) → 5 (lowest), with colour by urgency. */
export function PriorityBadge({ priority }: { priority: number }) {
  const color =
    priority <= 1
      ? "var(--color-signal-crit)"
      : priority === 2
        ? "var(--color-signal-warn)"
        : priority >= 4
          ? "var(--color-signal-idle)"
          : "var(--color-signal-ok)";
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md metric"
      style={{ color, border: `1px solid ${color}`, background: "rgba(8,12,24,0.6)" }}
      title="Priority (1 = highest)"
    >
      P{priority}
    </span>
  );
}

/** Horizontal budget bar: spent vs dedicated hours. */
export function HoursBar({ spent, dedicated }: { spent: number; dedicated: number }) {
  const pct = dedicated > 0 ? Math.min(100, (spent / dedicated) * 100) : 0;
  const over = spent > dedicated;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-paper dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: over ? "var(--color-signal-crit)" : "var(--color-signal-ok)",
          }}
        />
      </div>
      <span className="metric text-[10px] text-ink-soft dark:text-slate-400 whitespace-nowrap">
        {spent}/{dedicated}h
      </span>
    </div>
  );
}

function TimeLeft({ days }: { days: number | null }) {
  if (days == null) return <span className="text-[10px] text-ink-soft dark:text-slate-500">no due date</span>;
  const color =
    days < 0
      ? "var(--color-signal-crit)"
      : days <= 2
        ? "var(--color-signal-warn)"
        : "var(--color-signal-ok)";
  return (
    <span className="metric text-[10px]" style={{ color }}>
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}
    </span>
  );
}

const field = "text-[11px] text-ink-soft dark:text-slate-400 mb-1 block";
const inp = "input-base w-full !py-1.5 text-sm";

/** Full editable attribute form for a Task or Subtask. Saves on explicit Save button click. */
export function WorkItemEditor({
  item,
  onSave,
  onLogTime,
}: {
  item: WorkItemFields;
  onSave: (patch: WorkItemInput) => void | Promise<void>;
  onLogTime?: (hours: number, note: string | null) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState<WorkItemFields>(item);
  const [logHours, setLogHours] = useState("");
  const [logNote, setLogNote] = useState("");
  const [saved, setSaved] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Specific Knowledge defined while setting up this work item.
  const [sks, setSks] = useState<SpecificKnowledge[]>(item.specific_knowledges ?? []);
  const [skName, setSkName] = useState("");
  const [skRating, setSkRating] = useState<SKRating>("warm");
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    setDraft(item);
    setSks(item.specific_knowledges ?? []);
  }, [item]);

  const handleSave = async () => {
    const patch: WorkItemInput = {
      title: draft.title,
      description: draft.description,
      status: draft.status,
      priority: draft.priority,
      deadline: draft.deadline,
      dedicated_hours: draft.dedicated_hours,
      data_exposure_concern: draft.data_exposure_concern,
      last_checkpoint: draft.last_checkpoint,
      required_demo: draft.required_demo,
      flagged: draft.flagged,
      sk_ids: sks.map((s) => s.id),
    };
    await onSave(patch);
    setSaved(true);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setDraft(item);
    setSks(item.specific_knowledges ?? []);
  };

  // Ask the AI to name + rate the SK earned from this work item's description.
  const suggestSK = async () => {
    setSuggesting(true);
    try {
      const s = await api.suggestSK(draft.title, draft.description ?? "");
      setSkName(s.name);
      setSkRating(s.rating);
    } finally {
      setSuggesting(false);
    }
  };

  // Create (or reuse) the SK and attach it immediately — don't make the link
  // depend on the user remembering to hit the separate top-level Save button
  // (if they mark the item done another way, e.g. the Today check-in, before
  // saving, an unattached SK would silently never make it into the Universe).
  const addSK = async () => {
    const name = skName.trim();
    if (!name) return;
    const created = await api.createSK({ name, rating: skRating });
    const next = sks.some((s) => s.id === created.id) ? sks : [...sks, created];
    setSks(next);
    setSkName("");
    setSkRating("warm");
    await onSave({ sk_ids: next.map((s) => s.id) });
  };

  const removeSK = async (id: number) => {
    const next = sks.filter((s) => s.id !== id);
    setSks(next);
    await onSave({ sk_ids: next.map((s) => s.id) });
  };

  return (
    <div className="space-y-3 rounded-xl p-3 bg-ink/5 dark:bg-slate-900/40 border border-ink/10 dark:border-slate-800">
      {/* Title + description */}
      <div>
        <label className={field}>Title</label>
        <input
          className={inp}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>
      <div>
        <label className={field}>Description</label>
        <textarea
          className={`${inp} min-h-[56px] resize-y`}
          value={draft.description ?? ""}
          onChange={(e) => setDraft({ ...draft, description: e.target.value || null })}
          placeholder="What this entails…"
        />
      </div>

      {/* Status / priority / checkpoint */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={field}>Status</label>
          <select
            className={inp}
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as WorkStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={field}>Priority (1=top)</label>
          <select
            className={inp}
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5].map((p) => (
              <option key={p} value={p}>
                P{p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={field}>Last checkpoint</label>
          <select
            className={inp}
            value={draft.last_checkpoint ?? ""}
            onChange={(e) => setDraft({ ...draft, last_checkpoint: e.target.value || null })}
          >
            <option value="">—</option>
            {CHECKPOINTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadline / dedicated hours */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={field}>
            Deadline <TimeLeft days={draft.time_left_days} />
          </label>
          <input
            type="date"
            className={inp}
            value={draft.deadline ?? ""}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value || null })}
          />
        </div>
        <div>
          <label className={field}>Dedicated hours</label>
          <input
            type="number"
            min={0}
            step={0.5}
            className={inp}
            value={draft.dedicated_hours}
            onChange={(e) => setDraft({ ...draft, dedicated_hours: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-ink/80 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.data_exposure_concern}
            onChange={(e) => setDraft({ ...draft, data_exposure_concern: e.target.checked })}
            className="accent-rose-500"
          />
          🔒 Data exposure concern
        </label>
        <label className="flex items-center gap-2 text-xs text-ink/80 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.required_demo}
            onChange={(e) => setDraft({ ...draft, required_demo: e.target.checked })}
            className="accent-emerald-500"
          />
          🎬 Required demo
        </label>
        <label className="flex items-center gap-2 text-xs text-ink/80 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={draft.flagged}
            onChange={(e) => setDraft({ ...draft, flagged: e.target.checked })}
            className="accent-amber-500"
          />
          🚩 Flag — needs attention (shows on Today)
        </label>
      </div>

      {/* Hours budget + time logging */}
      <div className="rounded-lg p-2.5 bg-ink/5 dark:bg-slate-950/40 border border-ink/10 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-ink-soft dark:text-slate-400">Hours budget</span>
          <HoursBar spent={draft.spent_hours} dedicated={draft.dedicated_hours} />
          <span
            className="metric text-[11px]"
            style={{
              color:
                draft.remaining_hours < 0
                  ? "var(--color-signal-crit)"
                  : "var(--color-signal-ok)",
            }}
          >
            {draft.remaining_hours}h left
          </span>
        </div>
        {onLogTime && (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              min={0}
              step={0.25}
              placeholder="hrs"
              className={`${inp} w-full sm:!w-20`}
              value={logHours}
              onChange={(e) => setLogHours(e.target.value)}
            />
            <input
              className={`${inp} w-full sm:flex-1 sm:min-w-0`}
              placeholder="What did you work on? (optional)"
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
            />
            <button
              className="btn-secondary !px-3 !py-1.5 w-full sm:w-auto"
              onClick={async () => {
                const h = Number(logHours);
                if (h > 0) {
                  await onLogTime(h, logNote || null);
                  setLogHours("");
                  setLogNote("");
                }
              }}
            >
              Log time
            </button>
          </div>
        )}
      </div>

      {/* Specific Knowledge — defined while setting up the work item */}
      <div className="rounded-lg p-2.5 bg-ink/5 dark:bg-slate-950/40 border border-ink/10 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-soft dark:text-slate-400">
            Specific Knowledge
            <span className="text-ink-soft/70 dark:text-slate-600"> · earned on completion</span>
          </span>
        </div>

        {sks.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sks.map((sk) => {
              const color = ratingColor(sk.rating);
              return (
                <span
                  key={sk.id}
                  className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ color, background: `${color}14`, border: `1px solid ${color}40` }}
                  title={sk.ai_justification ?? undefined}
                >
                  {sk.name}
                  <span className="font-bold">· {ratingLabel(sk.rating)}</span>
                  <button
                    onClick={() => removeSK(sk.id)}
                    className="text-ink-soft dark:text-slate-500 hover:text-red-400"
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <input
            className={`${inp} flex-1 !min-w-[140px]`}
            placeholder="Knowledge name (e.g. SAP BTP Architecture)"
            value={skName}
            onChange={(e) => setSkName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addSK()}
          />
          <div className="flex gap-1">
            {RATINGS.map((r) => (
              <button
                key={r}
                onClick={() => setSkRating(r)}
                className="text-[10px] font-bold px-2 py-1 rounded-md border transition-all"
                style={{
                  color: skRating === r ? ratingColor(r) : "#94a3b8",
                  borderColor: skRating === r ? ratingColor(r) : "rgba(255,255,255,0.12)",
                  background: skRating === r ? `${ratingColor(r)}18` : "transparent",
                }}
              >
                {ratingLabel(r)}
              </button>
            ))}
          </div>
          <button
            className="btn-secondary !px-2.5 !py-1.5 text-xs"
            onClick={suggestSK}
            disabled={suggesting}
            title="Let AI name & rate the knowledge from this item's description"
          >
            {suggesting ? "…" : "✨ AI suggest"}
          </button>
          <button className="btn-secondary !px-3 !py-1.5" onClick={addSK}>
            Add
          </button>
        </div>
        <p className="text-[10px] text-ink-soft/70 dark:text-slate-600">
          AI suggests a HOT/WARM/COLD rating now; it's finalized when this item is completed. Attaching or removing a knowledge saves immediately.
        </p>
      </div>

      {/* Save / Clear */}
      <div className="flex gap-2 items-center">
        <button className="btn-primary !px-4 !py-1.5" onClick={handleSave}>
          Save
        </button>
        <button className="btn-secondary !px-4 !py-1.5" onClick={handleClear}>
          Clear
        </button>
        {saved && (
          <span
            className="text-[11px] transition-opacity"
            style={{ color: "var(--color-signal-ok)" }}
          >
            Saved ✓
          </span>
        )}
      </div>
    </div>
  );
}
