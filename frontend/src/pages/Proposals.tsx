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

  const describe = (a: ProposalAction): string => {
    if (a.type === "reorder") {
      const title = a.task_id != null ? tasks[a.task_id]?.title ?? `task #${a.task_id}` : "task";
      return `Move “${title}” to position ${a.position}`;
    }
    if (a.type === "add_pretask") {
      return `Add a new pre-task: “${a.title}”`;
    }
    return JSON.stringify(a);
  };

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
              {p.actions.map((a, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 rounded-lg px-3 py-2 bg-slate-900/50 border border-slate-800"
                >
                  <span className="text-violet-400">→</span>
                  <span>{describe(a)}</span>
                </li>
              ))}
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
