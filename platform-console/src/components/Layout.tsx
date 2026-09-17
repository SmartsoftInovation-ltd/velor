import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm ${isActive ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`;

const Layout = () => {
  const { user, isSuperadmin, signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-4 font-semibold">Platform console</span>
          <NavLink to="/" end className={link}>Stores</NavLink>
          <NavLink to="/permissions" className={link}>Permissions</NavLink>
          {isSuperadmin && <NavLink to="/users" className={link}>Operators</NavLink>}
          <span className="ml-auto text-xs text-slate-500">{user?.email} · {user?.role}</span>
          <button onClick={signOut} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
