import { useEffect, useState } from "react";
import { api } from "../api";
import type { ProposalAction, RebalanceProposal, System, Task } from "../types";
import { Card, Empty, PageHeader } from "../components/ui";

export function Proposals() {
  const [proposals, setProposals] = useState<RebalanceProposal[]>([]);
  const [tasks, setTasks] = useState<Record<number, Task>>({});
  const [systems, setSystems] = useState<Record<number, System>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    try {
      const [props, allTasks, allSystems] = await Promise.all([
        api.listProposals("pending"),
        api.listTasks(),
        api.listSystems(),
      ]);
      setProposals(props);
      setTasks(Object.fromEntries(allTasks.map((t) => [t.id, t])));
      setSystems(Object.fromEntries(allSystems.map((s) => [s.id, s])));
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const decide = async (id: number, approve: boolean) => {
    setBusy(id);
    try {
      await (approve ? api.approveProposal(id) : api.rejectProposal(id));
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };

  const titleOf = (id?: number) =>
    id != null ? tasks[id]?.title ?? `task #${id}` : "task";

  const attrSummary = (a: ProposalAction): string => {
    const bits: string[] = [];
    if (a.priority != null) bits.push(`P${a.priority}`);
    if (a.dedicated_hours != null) bits.push(`${a.dedicated_hours}h`);
    if (a.status) bits.push(a.status.replace("_", " "));
    if (a.last_checkpoint) bits.push(a.last_checkpoint);
    if (a.deadline) bits.push(`due ${a.deadline}`);
    if (a.data_exposure_concern) bits.push("🔒 data exposure");
    if (a.required_demo) bits.push("🎬 demo");
    return bits.length ? ` (${bits.join(", ")})` : "";
  };

  const describe = (a: ProposalAction): string => {
    switch (a.type) {
      case "reorder":
        return `Move “${titleOf(a.task_id)}” to position ${a.position}`;
      case "add_pretask":
        return `Add a pre-task: “${a.title}”${attrSummary(a)}`;
      case "add_task":
        return `Add task: “${a.title}”${attrSummary(a)}`;
      case "update_task":
        return `Update “${a.title ?? titleOf(a.task_id)}”${attrSummary(a)}`;
      case "add_subtask":
        return `Break down “${titleOf(a.task_id)}” → subtask “${a.title}”${attrSummary(a)}`;
      case "schedule":
        return `Schedule “${titleOf(a.task_id)}” on ${a.day}`;
      case "insight":
        return a.message ?? "";
      default:
        return JSON.stringify(a);
    }
  };

  const arrow = (a: ProposalAction) =>
    a.type === "insight"
      ? a.kind === "risk" || a.kind === "blocker"
        ? "⚠"
        : "💡"
      : "→";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposals"
        subtitle="The AI brain proposes changes; nothing is applied until you approve."
      />
      {error && <p className="text-amber-400 text-sm">{error}</p>}

      {proposals.length === 0 && (
        <Empty>
          No pending proposals. Open a system and click “Rebalance” to ask its agent.
        </Empty>
      )}

      {proposals.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-violet-500/40 flex items-center justify-center text-sm" aria-hidden>
              🤖
            </span>
            <span className="font-bold">
              {systems[p.system_id]?.name ?? `System #${p.system_id}`}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/60">
              {p.trigger}
            </span>
          </div>
          <p className="text-sm text-slate-300">{p.summary}</p>

          {p.actions.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              {p.actions.map((a, i) => {
                const isInsight = a.type === "insight";
                return (
                  <li
                    key={i}
                    className="flex gap-2.5 rounded-lg px-3 py-2 border"
                    style={{
                      background: isInsight ? "rgba(245,166,35,0.06)" : "rgba(8,12,24,0.5)",
                      borderColor: isInsight
                        ? "rgba(245,166,35,0.25)"
                        : "rgba(120,140,220,0.12)",
                    }}
                  >
                    <span className={isInsight ? "text-amber-400" : "text-violet-400"}>
                      {arrow(a)}
                    </span>
                    <span className={isInsight ? "text-amber-200/90" : ""}>{describe(a)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No actionable changes proposed.</p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              disabled={busy === p.id}
              onClick={() => decide(p.id, true)}
              className="btn-primary"
            >
              Approve
            </button>
            <button
              disabled={busy === p.id}
              onClick={() => decide(p.id, false)}
              className="btn-secondary"
            >
              Reject
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
