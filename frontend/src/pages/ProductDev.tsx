import { useEffect, useState } from "react";
import { api } from "../api";
import type { ProductProject, Sprint, Story, StoryStatus, StoryType } from "../types";

// ── Constants ─────────────────────────────────────────────────────────────────

const STORY_TYPE_META: Record<StoryType, { label: string; color: string; icon: string }> = {
  epic: { label: "Epic", color: "#a855f7", icon: "⚡" },
  story: { label: "Story", color: "#3b82f6", icon: "📖" },
  task: { label: "Task", color: "#10b981", icon: "✅" },
  bug: { label: "Bug", color: "#ef4444", icon: "🐛" },
};

const FIBONACCI = [1, 2, 3, 5, 8, 13];

const BOARD_COLUMNS: { status: StoryStatus; label: string; desc: string; color: string }[] = [
  { status: "backlog", label: "Backlog", desc: "Not yet in a sprint", color: "#64748b" },
  { status: "todo", label: "To Do", desc: "Ready to start", color: "#3b82f6" },
  { status: "doing", label: "In Progress", desc: "Being worked on", color: "#f59e0b" },
  { status: "review", label: "Review", desc: "Needs review / QA", color: "#8b5cf6" },
  { status: "done", label: "Done", desc: "Completed", color: "#10b981" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function phaseColor(phase: string) {
  const m: Record<string, string> = {
    idea: "#64748b", validate: "#f59e0b", build: "#3b82f6", launch: "#10b981",
  };
  return m[phase] ?? "#64748b";
}

function velocity(stories: Story[]) {
  return stories.filter(s => s.status === "done" && s.points).reduce((a, s) => a + (s.points ?? 0), 0);
}

// ── Story card ────────────────────────────────────────────────────────────────

function StoryCard({
  story,
  activeSprint,
  onUpdate,
  onDelete,
}: {
  story: Story;
  activeSprint: Sprint | undefined;
  onUpdate: (id: number, patch: object) => void;
  onDelete: (id: number) => void;
}) {
  const tm = STORY_TYPE_META[story.story_type as StoryType] ?? STORY_TYPE_META.story;
  const nextStatus: Record<StoryStatus, StoryStatus | null> = {
    backlog: null,
    todo: "doing",
    doing: "review",
    review: "done",
    done: null,
  };
  const next = nextStatus[story.status as StoryStatus];

  return (
    <div className="group bg-paper dark:bg-slate-800/60 border border-ink/10 dark:border-slate-700/60 rounded-xl p-3 hover:border-ink/25 dark:hover:border-slate-600 transition-all">
      <div className="flex items-start gap-2 mb-2">
        <span title={tm.label} className="mt-0.5 shrink-0 text-base">{tm.icon}</span>
        <span className="text-sm text-ink dark:text-slate-200 leading-snug flex-1">{story.title}</span>
        <button
          onClick={() => onDelete(story.id)}
          className="opacity-0 group-hover:opacity-100 text-ink-soft/70 dark:text-slate-600 hover:text-red-400 text-xs px-1 transition-opacity"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Points picker */}
        <select
          value={story.points ?? ""}
          onChange={(e) => onUpdate(story.id, { points: e.target.value ? Number(e.target.value) : null })}
          className="text-xs bg-ink/10 dark:bg-slate-700/60 border border-ink/10 dark:border-slate-600/40 rounded px-1.5 py-0.5 text-ink/80 dark:text-slate-300"
        >
          <option value="">pts</option>
          {FIBONACCI.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        {/* Priority */}
        <select
          value={story.priority}
          onChange={(e) => onUpdate(story.id, { priority: Number(e.target.value) })}
          className="text-xs bg-ink/10 dark:bg-slate-700/60 border border-ink/10 dark:border-slate-600/40 rounded px-1.5 py-0.5 text-ink/80 dark:text-slate-300"
        >
          {[1, 2, 3, 4, 5].map(p => (
            <option key={p} value={p}>P{p}</option>
          ))}
        </select>

        {/* Assign to sprint (only from backlog) */}
        {story.status === "backlog" && activeSprint && (
          <button
            onClick={() => onUpdate(story.id, { sprint_id: activeSprint.id })}
            className="text-xs bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded px-2 py-0.5 transition-colors"
          >
            → Sprint {activeSprint.number}
          </button>
        )}

        {/* Status advance */}
        {next && (
          <button
            onClick={() => onUpdate(story.id, { status: next })}
            className="text-xs bg-ink/10 dark:bg-slate-700 hover:bg-ink/15 dark:hover:bg-slate-600 text-ink/80 dark:text-slate-300 rounded px-2 py-0.5 transition-colors"
          >
            → {next === "doing" ? "Start" : next === "review" ? "Review" : "Done"}
          </button>
        )}

        {/* Return to backlog */}
        {story.status !== "backlog" && story.status !== "done" && (
          <button
            onClick={() => onUpdate(story.id, { sprint_id: null, status: "backlog" })}
            className="text-xs text-ink-soft/70 dark:text-slate-600 hover:text-ink dark:hover:text-slate-400 transition-colors ml-auto"
          >
            ↩ backlog
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add story form ─────────────────────────────────────────────────────────────

function AddStoryForm({ onAdd }: { onAdd: (title: string, type: StoryType) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<StoryType>("story");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await onAdd(title.trim(), type);
    setTitle("");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex gap-2 mt-3">
      <select
        value={type}
        onChange={e => setType(e.target.value as StoryType)}
        className="text-xs bg-paper dark:bg-slate-800 border border-ink/10 dark:border-slate-700 rounded-lg px-2 py-1.5 text-ink/80 dark:text-slate-300"
      >
        {(Object.keys(STORY_TYPE_META) as StoryType[]).map(t => (
          <option key={t} value={t}>{STORY_TYPE_META[t].icon} {STORY_TYPE_META[t].label}</option>
        ))}
      </select>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Add story, task, or bug…"
        className="flex-1 bg-paper dark:bg-slate-800 border border-ink/10 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-ink dark:text-slate-100 placeholder-ink-soft/70 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/60"
      />
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg px-3 py-1.5 transition-colors"
      >
        Add
      </button>
    </form>
  );
}

// ── Sprint panel ─────────────────────────────────────────────────────────────

function SprintPanel({
  sprints,
  activeSprint,
  stories,
  onCreateSprint,
  onActivateSprint,
  onCloseSprint,
}: {
  sprints: Sprint[];
  activeSprint: Sprint | undefined;
  stories: Story[];
  onCreateSprint: () => void;
  onActivateSprint: (id: number) => void;
  onCloseSprint: (id: number) => void;
}) {
  const vel = velocity(stories);
  const sprintStories = activeSprint ? stories.filter(s => s.sprint_id === activeSprint.id) : [];
  const doneInSprint = sprintStories.filter(s => s.status === "done").length;

  return (
    <div className="bg-paper dark:bg-slate-800/40 border border-ink/10 dark:border-slate-700/60 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink dark:text-slate-200">Sprints</h3>
        <button
          onClick={onCreateSprint}
          className="text-xs bg-ink/10 dark:bg-slate-700 hover:bg-ink/15 dark:hover:bg-slate-600 text-ink/80 dark:text-slate-300 rounded-lg px-3 py-1 transition-colors"
        >
          + New Sprint
        </button>
      </div>

      {sprints.length === 0 && (
        <p className="text-xs text-ink-soft dark:text-slate-500 italic">No sprints yet — create one to start planning.</p>
      )}

      <div className="space-y-2">
        {sprints.map(sp => (
          <div
            key={sp.id}
            className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
              sp.status === "active"
                ? "border-blue-500/40 bg-blue-500/10"
                : "border-ink/10 dark:border-slate-700/40 bg-paper/80 dark:bg-slate-800/30"
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-ink dark:text-slate-200">Sprint {sp.number}</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{
                    background: sp.status === "active" ? "rgba(59,130,246,0.2)" : "rgba(100,116,139,0.2)",
                    color: sp.status === "active" ? "#93c5fd" : "#94a3b8",
                  }}
                >
                  {sp.status}
                </span>
              </div>
              {sp.goal && <p className="text-xs text-ink-soft dark:text-slate-400 truncate mt-0.5">{sp.goal}</p>}
            </div>
            <div className="text-xs text-ink-soft dark:text-slate-500 shrink-0">
              {sp.done_count}/{sp.story_count}
            </div>
            {sp.status === "planning" && (
              <button
                onClick={() => onActivateSprint(sp.id)}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-2.5 py-1 transition-colors"
              >
                Start
              </button>
            )}
            {sp.status === "active" && (
              <button
                onClick={() => onCloseSprint(sp.id)}
                className="text-xs bg-ink/10 dark:bg-slate-700 hover:bg-ink/15 dark:hover:bg-slate-600 text-ink/80 dark:text-slate-300 rounded-lg px-2.5 py-1 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        ))}
      </div>

      {activeSprint && (
        <div className="mt-3 pt-3 border-t border-ink/10 dark:border-slate-700/40 flex gap-4 text-xs text-ink-soft dark:text-slate-400">
          <span>{doneInSprint}/{sprintStories.length} stories done</span>
          {vel > 0 && <span>{vel} pts velocity</span>}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ProductDev() {
  const [projects, setProjects] = useState<ProductProject[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "sprints">("board");

  const selected = projects.find(p => p.id === selectedId) ?? null;
  const activeSprint = sprints.find(s => s.status === "active");

  useEffect(() => {
    api.listProductProjects().then(ps => {
      setProjects(ps);
      if (ps.length > 0 && selectedId === null) setSelectedId(ps[0].id);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedId) return;
    Promise.all([
      api.listStories(selectedId),
      api.listSprints(selectedId),
    ]).then(([ss, sps]) => {
      setStories(ss);
      setSprints(sps);
    });
  }, [selectedId]);

  async function handleAddStory(title: string, type: StoryType) {
    if (!selectedId) return;
    const s = await api.createStory(selectedId, { title, story_type: type });
    setStories(prev => [...prev, s]);
  }

  async function handleUpdateStory(id: number, patch: object) {
    const updated = await api.updateStory(id, patch);
    setStories(prev => prev.map(s => s.id === id ? updated : s));
    // Refresh sprint counts
    if (selectedId) {
      const sps = await api.listSprints(selectedId);
      setSprints(sps);
    }
  }

  async function handleDeleteStory(id: number) {
    await api.deleteStory(id);
    setStories(prev => prev.filter(s => s.id !== id));
  }

  async function handleCreateSprint() {
    if (!selectedId) return;
    const sp = await api.createSprint(selectedId, {});
    setSprints(prev => [...prev, sp]);
  }

  async function handleActivateSprint(id: number) {
    const sp = await api.updateSprint(id, { status: "active" });
    setSprints(prev => prev.map(s => s.id === id ? sp : s.status === "active" ? { ...s, status: "review" as const } : s));
  }

  async function handleCloseSprint(id: number) {
    const sp = await api.updateSprint(id, { status: "closed" });
    setSprints(prev => prev.map(s => s.id === id ? sp : s));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-soft dark:text-slate-400 text-sm">
        Loading…
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-ink dark:text-slate-100">Product Dev</h1>
        <div className="bg-paper dark:bg-slate-800/40 border border-ink/10 dark:border-slate-700/50 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">🚀</div>
          <p className="text-ink/80 dark:text-slate-300 font-medium mb-1">No products yet</p>
          <p className="text-ink-soft dark:text-slate-500 text-sm">
            Go to <strong>Wall of Pains</strong> and promote a pain point to a project —
            it will appear here ready for sprint planning.
          </p>
        </div>
      </div>
    );
  }

  // Group stories by board column
  const byStatus = (status: StoryStatus) =>
    stories.filter(s => {
      if (status === "backlog") return s.status === "backlog";
      return s.status === status;
    });

  const totalDone = stories.filter(s => s.status === "done").length;
  const totalPoints = stories.filter(s => s.points).reduce((a, s) => a + (s.points ?? 0), 0);
  const donePoints = stories.filter(s => s.status === "done" && s.points).reduce((a, s) => a + (s.points ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-ink dark:text-slate-100">Product Dev</h1>
        <span className="text-ink-soft dark:text-slate-500 text-sm">Scrum board for your product ideas</span>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Project list sidebar */}
        <aside className="w-full md:w-52 md:shrink-0 space-y-1.5">
          <p className="text-[11px] font-semibold text-ink-soft dark:text-slate-500 uppercase tracking-wider px-1 mb-2">Products</p>
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                p.id === selectedId
                  ? "bg-blue-500/15 border-blue-500/30 text-ink dark:text-slate-100"
                  : "border-transparent text-ink-soft dark:text-slate-400 hover:text-ink dark:hover:text-slate-200 hover:bg-ink/10 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="font-medium truncate">{p.name}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${phaseColor(p.phase)}22`,
                    color: phaseColor(p.phase),
                  }}
                >
                  {p.phase}
                </span>
                <span className="text-[10px] text-ink-soft dark:text-slate-500">{p.done_count}/{p.story_count} done</span>
              </div>
            </button>
          ))}
        </aside>

        {/* Main content */}
        {selected && (
          <div className="flex-1 min-w-0 space-y-4">
            {/* Project header */}
            <div className="bg-paper dark:bg-slate-800/40 border border-ink/10 dark:border-slate-700/60 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-ink dark:text-slate-100">{selected.name}</h2>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${phaseColor(selected.phase)}22`,
                        color: phaseColor(selected.phase),
                      }}
                    >
                      {selected.phase}
                    </span>
                  </div>
                  {selected.problem_statement && (
                    <p className="text-sm text-ink-soft dark:text-slate-400">{selected.problem_statement}</p>
                  )}
                </div>
                <div className="flex gap-4 text-center shrink-0">
                  <div>
                    <div className="text-lg font-bold text-ink dark:text-slate-100">{totalDone}/{stories.length}</div>
                    <div className="text-[10px] text-ink-soft dark:text-slate-500">stories done</div>
                  </div>
                  {totalPoints > 0 && (
                    <div>
                      <div className="text-lg font-bold text-ink dark:text-slate-100">{donePoints}/{totalPoints}</div>
                      <div className="text-[10px] text-ink-soft dark:text-slate-500">points</div>
                    </div>
                  )}
                  {activeSprint && (
                    <div>
                      <div className="text-lg font-bold text-blue-400">Sprint {activeSprint.number}</div>
                      <div className="text-[10px] text-ink-soft dark:text-slate-500">active</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* View switcher */}
            <div className="flex gap-2">
              {(["board", "sprints"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                    view === v
                      ? "bg-ink/10 dark:bg-slate-700 text-ink dark:text-slate-100"
                      : "text-ink-soft dark:text-slate-500 hover:text-ink dark:hover:text-slate-300"
                  }`}
                >
                  {v === "board" ? "🗂 Board" : "🏃 Sprints"}
                </button>
              ))}
            </div>

            {/* Board view */}
            {view === "board" && (
              <div className="space-y-4">
                {/* Add story */}
                <AddStoryForm onAdd={handleAddStory} />

                {/* Columns */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  {BOARD_COLUMNS.map(col => {
                    const colStories = byStatus(col.status);
                    return (
                      <div key={col.status} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ background: col.color }}
                          />
                          <span className="text-xs font-semibold text-ink-soft dark:text-slate-400 uppercase tracking-wider">
                            {col.label}
                          </span>
                          <span className="text-xs text-ink-soft/70 dark:text-slate-600 ml-auto">{colStories.length}</span>
                        </div>
                        <div className="space-y-2 min-h-[4rem]">
                          {colStories.map(s => (
                            <StoryCard
                              key={s.id}
                              story={s}
                              activeSprint={activeSprint}
                              onUpdate={handleUpdateStory}
                              onDelete={handleDeleteStory}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sprints view */}
            {view === "sprints" && (
              <SprintPanel
                sprints={sprints}
                activeSprint={activeSprint}
                stories={stories}
                onCreateSprint={handleCreateSprint}
                onActivateSprint={handleActivateSprint}
                onCloseSprint={handleCloseSprint}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
