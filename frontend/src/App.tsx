import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getToken } from "./api";
import { Login } from "./pages/Login";
import { BottomNavBar } from "./components/me/BottomNavBar";
import { DateHeader } from "./components/me/DateHeader";
import { ME_BG } from "./components/me/tokens";

export function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const location = useLocation();
  const isFullBleed = location.pathname === "/sk-universe";
  // The Today page has fully adopted the ME style — give it its own cream
  // canvas so the gaps between pastel cards aren't the dark shell behind it.
  // Other pages stay on the existing dark theme until migrated.
  const isMeStyled = location.pathname === "/";

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className={`min-h-screen flex flex-col ${isMeStyled ? "" : "bg-slate-900 text-slate-100"}`} style={isMeStyled ? { background: ME_BG } : undefined}>
      {/* Ambient background glow (still-dark pages) */}
      {!isMeStyled && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent),radial-gradient(ellipse_40%_30%_at_90%_100%,rgba(139,92,246,0.08),transparent)]"
        />
      )}

      {/* Shell chrome — ME style: persistent date header + bottom nav on every screen */}
      {!isFullBleed && <DateHeader />}

      <main className={`relative z-10 flex-1 w-full ${isFullBleed ? "overflow-hidden p-0" : "max-w-4xl mx-auto px-4 md:px-8 py-6 pb-28"}`}>
        <Outlet />
      </main>

      <BottomNavBar />
    </div>
  );
}
