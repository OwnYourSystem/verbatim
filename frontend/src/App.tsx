import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearToken, getToken } from "./api";
import { Login } from "./pages/Login";

const NAV = [
  { to: "/", end: true, label: "Today", icon: "☀️" },
  { to: "/systems", label: "Systems", icon: "🗂️" },
  { to: "/calendar", label: "Calendar", icon: "📅" },
  { to: "/proposals", label: "Proposals", icon: "🤖" },
  { to: "/intake", label: "New system", icon: "✨" },
  { to: "/reports", label: "Reports", icon: "📊" },
  { to: "/knowledge-pool", label: "Knowledge Pool", icon: "🌡️" },
  { to: "/sk-universe", label: "SK Universe", icon: "🪐" },
  { to: "/checkout-asap", label: "Check Out ASAP", icon: "📌" },
  { to: "/wall-of-pains", label: "Wall of Pains", icon: "🩹" },
];

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
    isActive
      ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
      : "text-slate-400 border border-transparent hover:text-slate-100 hover:bg-slate-800/60"
  }`;

const topLink = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
    isActive
      ? "bg-slate-700 text-emerald-300"
      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
  }`;

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
        <span className="text-lg" aria-hidden>⚓</span>
      </div>
      <span className="font-extrabold tracking-tight text-lg">
        Mind<span className="text-gradient">Anchor</span>
      </span>
    </div>
  );
}

function SignOutButton() {
  const navigate = useNavigate();
  const handleSignOut = () => {
    clearToken();
    navigate("/");
    window.location.reload();
  };
  return (
    <button
      onClick={handleSignOut}
      className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors text-left"
    >
      Sign out
    </button>
  );
}

export function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const location = useLocation();
  const isFullBleed = location.pathname === "/sk-universe";

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent),radial-gradient(ellipse_40%_30%_at_90%_100%,rgba(139,92,246,0.08),transparent)]"
      />

      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-slate-800/80 bg-slate-950/60 backdrop-blur-sm sticky top-0 h-screen px-4 py-6 z-20">
        <div className="px-1 mb-8">
          <Logo />
        </div>
        <nav className="flex flex-col gap-1.5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={sideLink}>
              <span aria-hidden className="text-base">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-1 space-y-1">
          <p className="text-[11px] text-slate-600">Your external brain</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Top bar — mobile */}
      <header className="md:hidden border-b border-slate-800/80 sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md">
        <div className="px-4 flex items-center gap-3 h-14">
          <Logo />
        </div>
        <nav className="flex gap-1 overflow-x-auto scrollbar-none px-3 pb-2">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={topLink}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className={`relative z-10 flex-1 w-full ${isFullBleed ? "overflow-hidden p-0" : "max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 pb-[env(safe-area-inset-bottom,1rem)]"}`}>
        <Outlet />
      </main>
    </div>
  );
}
