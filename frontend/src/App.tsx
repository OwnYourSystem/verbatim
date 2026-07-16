import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getToken } from "./api";
import { Login } from "./pages/Login";
import { BottomNavBar } from "./components/me/BottomNavBar";
import { DateHeader } from "./components/me/DateHeader";

export function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const location = useLocation();
  // SK Universe is its own immersive starfield canvas — exempt from the page
  // chrome (and from the light/dark toggle) regardless of theme, the same
  // way a map view usually ignores the host app's theme.
  const isFullBleed = location.pathname === "/sk-universe";

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-cream text-ink dark:bg-slate-900 dark:text-slate-100">
      {/* Ambient background glow (dark theme only) */}
      {!isFullBleed && (
        <div
          aria-hidden
          className="hidden dark:block pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(16,185,129,0.12),transparent),radial-gradient(ellipse_40%_30%_at_90%_100%,rgba(139,92,246,0.08),transparent)]"
        />
      )}

      {/* Shell chrome — persistent date header + bottom nav on every screen */}
      {!isFullBleed && <DateHeader />}

      <main className={`relative z-10 flex-1 w-full ${isFullBleed ? "overflow-hidden p-0" : "max-w-4xl mx-auto px-4 md:px-8 py-6 pb-28"}`}>
        <Outlet />
      </main>

      <BottomNavBar />
    </div>
  );
}
