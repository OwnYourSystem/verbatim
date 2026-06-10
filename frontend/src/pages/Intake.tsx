import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { IntakeAnswer, IntakeProposal } from "../types";
import { Card, Empty } from "../components/ui";

export function Intake() {
  const [history, setHistory] = useState<IntakeAnswer[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [proposal, setProposal] = useState<IntakeProposal | null>(null);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const navigate = useNavigate();

  const step = async (nextHistory: IntakeAnswer[]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.intakeNext(nextHistory);
      if (res.done && res.proposal) {
        setProposal(res.proposal);
        setQuestion(null);
      } else {
        setQuestion(res.question ?? null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  // Kick off the interview once.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    step([]);
  }, []);

  const submitAnswer = async () => {
    if (!answer.trim() || !question) return;
    const next = [...history, { question, answer: answer.trim() }];
    setHistory(next);
    setAnswer("");
    await step(next);
  };

  const create = async () => {
    if (!proposal) return;
    setBusy(true);
    try {
      const system = await api.intakeCommit(proposal);
      navigate(`/systems`);
      return system;
    } catch (e) {
      setError(String(e));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New system — intake</h1>
      <p className="text-sm text-slate-400">
        Answer one question at a time. When done, review the proposed system and tasks
        before anything is saved.
      </p>
      {error && <p className="text-amber-400 text-sm">{error}</p>}

      {history.length > 0 && (
        <Card title="So far">
          <ul className="space-y-2 text-sm">
            {history.map((h, i) => (
              <li key={i}>
                <div className="text-slate-400">{h.question}</div>
                <div>{h.answer}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {question && !proposal && (
        <Card title="Question">
          <p className="mb-3">{question}</p>
          <div className="flex gap-2">
            <input
              autoFocus
              className="flex-1 rounded-md bg-slate-900 border border-slate-700 p-2 text-sm"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
              disabled={busy}
            />
            <button
              onClick={submitAnswer}
              disabled={busy}
              className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-sm font-medium disabled:opacity-50"
            >
              {busy ? "…" : "Next"}
            </button>
          </div>
        </Card>
      )}

      {proposal && (
        <Card title="Proposed system">
          <div className="space-y-2 text-sm">
            <div className="text-lg font-semibold">{proposal.system.name}</div>
            {(["purpose", "goals", "constraints", "dependencies", "delivery_expectations"] as const).map(
              (f) =>
                proposal.system[f] ? (
                  <div key={f}>
                    <span className="text-slate-400 capitalize">
                      {f.replace("_", " ")}:
                    </span>{" "}
                    {proposal.system[f]}
                  </div>
                ) : null,
            )}
          </div>

          <h3 className="text-xs uppercase tracking-wide text-slate-500 mt-4 mb-2">
            Proposed tasks
          </h3>
          {proposal.tasks.length === 0 ? (
            <Empty>No tasks proposed.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {proposal.tasks.map((t, i) => (
                <li key={i}>
                  <div className="font-medium">{t.title}</div>
                  {t.subtasks.length > 0 && (
                    <ul className="pl-4 list-disc text-slate-300">
                      {t.subtasks.map((st, j) => (
                        <li key={j}>{st.title}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            onClick={create}
            disabled={busy}
            className="mt-4 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create system"}
          </button>
        </Card>
      )}
    </div>
  );
}
