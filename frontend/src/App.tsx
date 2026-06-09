import { useEffect, useState } from "react";

type Health = { status: string; environment?: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setError("Backend not reachable yet (start it on :8000)."));
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <h1 className="text-3xl font-bold tracking-tight">MindAnchor</h1>
        <p className="mt-2 text-slate-400">
          Your external brain — AI project manager, scrum master & calendar.
        </p>

        <div className="mt-8 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
          <div className="text-sm uppercase tracking-wide text-slate-500">
            Backend status
          </div>
          {health ? (
            <div className="mt-1 text-emerald-400 font-medium">
              {health.status} · {health.environment ?? "—"}
            </div>
          ) : error ? (
            <div className="mt-1 text-amber-400 text-sm">{error}</div>
          ) : (
            <div className="mt-1 text-slate-400 text-sm">checking…</div>
          )}
        </div>

        <p className="mt-8 text-xs text-slate-600">
          Phase 1 skeleton. Data model, dashboard, and the AI brain come next.
        </p>
      </div>
    </div>
  );
}
