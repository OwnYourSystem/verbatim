import type { ReactNode } from "react";
import type { WorkStatus } from "../types";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="animate-fade-up rounded-2xl border border-slate-700/60 bg-slate-800/40 backdrop-blur-sm p-5 shadow-xl shadow-black/20 transition-colors duration-200 hover:border-slate-600/60">
      {title && (
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-4">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="animate-fade-up">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
    </div>
  );
}

const statusStyles: Record<WorkStatus, string> = {
  todo: "bg-slate-700/80 text-slate-300 border-slate-600",
  in_progress: "bg-blue-500/15 text-blue-300 border-blue-500/40",
  blocked: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
};

export function StatusBadge({ status }: { status: WorkStatus }) {
  return (
    <span
      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${statusStyles[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-slate-500 py-1">
      <span aria-hidden className="opacity-60">○</span>
      {children}
    </div>
  );
}
