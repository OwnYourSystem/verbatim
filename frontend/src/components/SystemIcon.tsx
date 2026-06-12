import { useState } from "react";

/** Full palette of selectable system icons. */
export const ICON_PALETTE = [
  "💻", "🤖", "📊", "🔒", "🎨", "💰", "📣", "🔬", "🏥", "📋",
  "☁️", "📱", "🧪", "🗺️", "🤝", "⚖️", "👥", "✍️", "🏢", "🚀",
  "🎯", "📦", "🔧", "⚡", "🌐", "📚", "🧠", "🎬", "🔗", "🗄️",
] as const;

/** Map name keywords → emoji. Longest keyword wins (matched case-insensitively). */
const KEYWORD_MAP: [string[], string][] = [
  [["ai", "ml", "machine learning", "llm", "gpt", "model", "anthropic", "openai"], "🤖"],
  [["security", "auth", "privacy", "compliance", "pentest", "cyber"], "🔒"],
  [["data", "analytics", "sql", "database", "bi", "warehouse", "datasphere"], "📊"],
  [["design", "ui", "ux", "figma", "creative", "visual"], "🎨"],
  [["finance", "budget", "accounting", "money", "cost", "invoice", "billing"], "💰"],
  [["marketing", "brand", "social", "seo", "content", "campaign"], "📣"],
  [["research", "science", "study", "experiment", "lab"], "🔬"],
  [["health", "fitness", "wellness", "medical", "clinical"], "🏥"],
  [["cloud", "infra", "devops", "deploy", "server", "kubernetes", "docker"], "☁️"],
  [["mobile", "ios", "android", "expo", "react native"], "📱"],
  [["test", "qa", "quality", "spec"], "🧪"],
  [["product", "roadmap", "planning", "strategy"], "🗺️"],
  [["sales", "crm", "customer", "client"], "🤝"],
  [["legal", "contract", "compliance"], "⚖️"],
  [["hr", "people", "hiring", "recruiting", "team"], "👥"],
  [["writing", "docs", "documentation", "content"], "✍️"],
  [["enterprise", "sap", "erp", "corporate"], "🏢"],
  [["launch", "startup", "mvp"], "🚀"],
  [["goal", "okr", "kpi", "target"], "🎯"],
  [["package", "shipping", "logistics", "supply"], "📦"],
  [["infra", "tooling", "tool", "build", "ci", "pipeline"], "🔧"],
  [["perf", "performance", "speed", "optim"], "⚡"],
  [["web", "website", "frontend", "backend", "api", "sap"], "🌐"],
  [["learn", "training", "education", "book", "course"], "📚"],
  [["brain", "think", "cognitive", "mental"], "🧠"],
  [["video", "media", "youtube", "film", "demo"], "🎬"],
  [["integration", "link", "connect", "webhook"], "🔗"],
  [["storage", "disk", "backup", "archive"], "🗄️"],
  [["report", "meeting", "project", "manage"], "📋"],
  [["code", "dev", "software", "engineer", "program", "app", "cli"], "💻"],
];

/** Suggest an icon based on the system name. Returns "🗂️" as default. */
export function suggestIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [keywords, icon] of KEYWORD_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return icon;
  }
  return "🗂️";
}

/** Compact inline icon picker — shows current icon as a button that opens a grid. */
export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-2xl leading-none rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-800 active:scale-95"
        title="Change icon"
      >
        {value}
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute left-0 top-full mt-1 z-30 p-2 rounded-2xl grid grid-cols-6 gap-1"
            style={{
              background: "rgba(8,12,24,0.96)",
              border: "1px solid rgba(120,140,220,0.2)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              minWidth: "220px",
            }}
          >
            {ICON_PALETTE.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => { onChange(emoji); setOpen(false); }}
                className={`text-xl leading-none rounded-lg p-1.5 transition-colors hover:bg-slate-700 ${
                  value === emoji ? "bg-slate-700 ring-1 ring-emerald-500/60" : ""
                }`}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Display-only system icon badge. */
export function SystemIconBadge({ icon, size = "md" }: { icon?: string | null; size?: "sm" | "md" | "lg" }) {
  const display = icon ?? "🗂️";
  const cls =
    size === "sm" ? "text-base" : size === "lg" ? "text-3xl" : "text-xl";
  return <span className={cls} role="img">{display}</span>;
}
