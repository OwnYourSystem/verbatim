import type { ReactNode } from "react";
import type { WorkStatus } from "../types";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      {title && (
        <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-3">{title}</h2>
      )}
      {children}
    </section>
  );
}

const statusColors: Record<WorkStatus, string> = {
  todo: "bg-slate-600",
  in_progress: "bg-blue-600",
  blocked: "bg-amber-600",
  done: "bg-emerald-600",
};

export function StatusBadge({ status }: { status: WorkStatus }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${statusColors[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}
