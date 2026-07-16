import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clearToken } from "../../api";
import { useTheme } from "../../theme";
import { ME_ACCENT, ME_BG, ME_BORDER, ME_GHOST_BG, ME_INK, ME_INK_SOFT, ME_OVERLAY, ME_SURFACE, ME_SURFACE_SOFT } from "./tokens";

/** Thumb-reachable primary tabs. MindAnchor has 11 destinations — more than a
 *  bottom bar can hold — so the 3 most-used stay pinned and the rest live in
 *  the "More" sheet, which is still bottom-anchored and one tap away. */
const PRIMARY = [
  { to: "/", end: true, label: "Today", icon: "☀️" },
  { to: "/systems", label: "Systems", icon: "🗂️" },
  { to: "/calendar", label: "Calendar", icon: "📅" },
];

const MORE = [
  { to: "/focus-timer", label: "Focus Timer", icon: "⏱️" },
  { to: "/proposals", label: "Proposals", icon: "🤖" },
  { to: "/intake", label: "New system", icon: "✨" },
  { to: "/reports", label: "Reports", icon: "📊" },
  { to: "/knowledge-pool", label: "Knowledge Pool", icon: "🌡️" },
  { to: "/sk-universe", label: "SK Universe", icon: "🪐" },
  { to: "/checkout-asap", label: "Check Out ASAP", icon: "📌" },
  { to: "/wall-of-pains", label: "Wall of Pains", icon: "🩹" },
  { to: "/product-dev", label: "Product Dev", icon: "🚀" },
];

function TabButton({ to, end, label, icon }: { to: string; end?: boolean; label: string; icon: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-[60px] rounded-2xl transition-all duration-200"
      style={({ isActive }) => ({
        background: isActive ? "var(--me-accent-tint)" : "transparent",
        color: isActive ? ME_ACCENT : ME_INK_SOFT,
      })}
    >
      <span className="text-xl" aria-hidden>
        {icon}
      </span>
      <span className="text-[10px] font-bold">{label}</span>
    </NavLink>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggleTheme}
      className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mt-2"
      style={{ background: ME_GHOST_BG, color: ME_INK }}
    >
      <span className="text-sm font-semibold">{isDark ? "🌙 Dark mode" : "☀️ Light mode"}</span>
      <span
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200"
        style={{ background: isDark ? ME_ACCENT : "rgba(60,50,40,0.18)" }}
        aria-hidden
      >
        <span
          className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: isDark ? "translateX(22px)" : "translateX(2px)" }}
        />
      </span>
    </button>
  );
}

/** Fixed action bar at the bottom of every screen — primary nav lives here,
 *  not in a top nav or hamburger menu. */
export function BottomNavBar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = () => {
    clearToken();
    navigate("/");
    window.location.reload();
  };

  return (
    <>
      {moreOpen && (
        <div className="fixed inset-0 z-30 flex items-end justify-center" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0" style={{ background: ME_OVERLAY }} />
          <div
            className="relative w-full max-w-lg rounded-t-3xl p-4 pb-[max(env(safe-area-inset-bottom),1rem)]"
            style={{ background: ME_SURFACE, boxShadow: "0 -20px 60px rgba(60,50,40,0.25)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-10 rounded-full mx-auto mb-4" style={{ background: ME_BORDER }} />
            <div className="grid grid-cols-4 gap-2">
              {MORE.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl text-center"
                  style={{ color: ME_INK }}
                >
                  <span className="text-2xl" aria-hidden>
                    {n.icon}
                  </span>
                  <span className="text-[11px] font-semibold leading-tight">{n.label}</span>
                </NavLink>
              ))}
            </div>
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="w-full mt-2 text-center text-xs font-medium py-2"
              style={{ color: ME_INK_SOFT }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
      <nav
        className="fixed bottom-0 inset-x-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
        style={{ background: ME_SURFACE_SOFT, backdropFilter: "blur(12px)", borderTop: `1px solid ${ME_BORDER}` }}
      >
        <div className="max-w-lg mx-auto flex items-stretch gap-1">
          {PRIMARY.map((n) => (
            <TabButton key={n.to} {...n} />
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-[60px] rounded-2xl transition-all duration-200"
            style={{ color: ME_INK_SOFT, background: ME_BG }}
          >
            <span className="text-xl" aria-hidden>
              ⋯
            </span>
            <span className="text-[10px] font-bold">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
