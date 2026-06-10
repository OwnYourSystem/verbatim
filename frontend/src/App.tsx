import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
  }`;

export function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-2 h-14">
          <span className="font-bold tracking-tight mr-4">MindAnchor</span>
          <nav className="flex gap-1">
            <NavLink to="/" end className={linkClass}>
              Today
            </NavLink>
            <NavLink to="/systems" className={linkClass}>
              Systems
            </NavLink>
            <NavLink to="/calendar" className={linkClass}>
              Calendar
            </NavLink>
            <NavLink to="/proposals" className={linkClass}>
              Proposals
            </NavLink>
            <NavLink to="/intake" className={linkClass}>
              New system
            </NavLink>
            <NavLink to="/reports" className={linkClass}>
              Reports
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
