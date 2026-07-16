import { useMemo } from "react";
import { ME_ACCENT, ME_BG, ME_BORDER, ME_INK, ME_INK_SOFT } from "./tokens";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function greeting(hour: number): string {
  if (hour < 5) return "Still up?";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Winding down?";
}

/** Persistent calendar/date strip — anchors every screen so the user always
 *  knows "when" they are without scrolling. Shell chrome, always visible. */
export function DateHeader() {
  const now = useMemo(() => new Date(), []);
  const days = useMemo(() => {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [now]);

  const monthLabel = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <header
      className="sticky top-0 z-20 px-4 sm:px-6 pt-[max(env(safe-area-inset-top),1rem)] pb-3"
      style={{ background: ME_BG, borderBottom: `1px solid ${ME_BORDER}` }}
    >
      <div className="max-w-4xl mx-auto">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ME_INK_SOFT }}>
            {monthLabel}
          </p>
        </div>
        <p className="text-lg font-extrabold mb-3" style={{ color: ME_INK }}>
          {greeting(now.getHours())} 👋
        </p>
        <div className="flex justify-between gap-1">
          {days.map((d) => {
            const isToday = d.toDateString() === now.toDateString();
            return (
              <div key={d.toISOString()} className="flex flex-col items-center gap-1 flex-1">
                <span className="text-[10px] font-semibold" style={{ color: ME_INK_SOFT }}>
                  {WEEKDAY_LABELS[d.getDay()]}
                </span>
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                  style={
                    isToday
                      ? { background: ME_ACCENT, color: "#fff", boxShadow: "0 6px 16px rgba(255,137,100,0.4)" }
                      : { color: ME_INK_SOFT }
                  }
                >
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
