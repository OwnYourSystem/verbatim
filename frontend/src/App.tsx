import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
    isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
  }`;

export function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800 sticky top-0 z-10 bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-2 h-14">
          <span className="font-bold tracking-tight mr-2 shrink-0">MindAnchor</span>
          {/* Nav scrolls horizontally on small screens */}
          <nav className="flex gap-1 overflow-x-auto scrollbar-none min-w-0 flex-1">
            <NavLink to="/" end className={linkClass}>Today</NavLink>
            <NavLink to="/systems" className={linkClass}>Systems</NavLink>
            <NavLink to="/calendar" className={linkClass}>Calendar</NavLink>
            <NavLink to="/proposals" className={linkClass}>Proposals</NavLink>
            <NavLink to="/intake" className={linkClass}>New system</NavLink>
            <NavLink to="/reports" className={linkClass}>Reports</NavLink>
          </nav>
        </div>
      </header>
      {/* pb-safe adds padding above iOS home indicator */}
      <main className="max-w-5xl mx-auto w-full px-4 py-6 flex-1 pb-[env(safe-area-inset-bottom,1rem)]">
        <Outlet />
      </main>
    </div>
  );
}
