import type { ReactNode } from "react";
import { Link } from "react-router";
import { FiArrowUpRight, FiClock, FiPackage, FiRepeat, FiShoppingCart } from "react-icons/fi";
import { useAuth } from "../../../context/AuthContext";

interface QuickAction {
  label: string;
  to: string;
  icon: ReactNode;
  /** Same permission the target route checks, so a button never leads to "unauthorized" */
  module: string;
  action: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Sales", to: "/create-retail-sales", icon: <FiShoppingCart />, module: "retail-sales", action: "add" },
  { label: "Stock", to: "/view-all-stock", icon: <FiPackage />, module: "view-all-stock", action: "view" },
  { label: "Transaction", to: "/add-transaction", icon: <FiRepeat />, module: "add-transaction", action: "add" },
];

// Top of the dashboard: the store's name, shortcuts to the daily screens and,
// in `toolbar`, the dashboard's own period filter and refresh
const WelcomeBar = ({ subtitle, toolbar }: { subtitle?: ReactNode; toolbar?: ReactNode }) => {
  const { tenant, can } = useAuth();
  const actions = QUICK_ACTIONS.filter((a) => can(a.module, a.action));

  return (
    <section className="relative overflow-hidden rounded-2xl border border-accent-100 bg-gradient-to-r from-accent-50 via-white to-white px-5 py-4 shadow-theme-xs dark:border-accent-500/20 dark:from-accent-500/10 dark:via-white/[0.03] dark:to-white/[0.03]">
      <div aria-hidden className="pointer-events-none absolute -left-10 -top-16 size-40 rounded-full bg-accent-400/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 right-1/3 size-44 rounded-full bg-accent-300/10 blur-3xl" />

      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600 dark:text-accent-400">Welcome to</p>
            <h1 className="truncate text-lg font-extrabold uppercase tracking-wide text-gray-900 sm:text-xl dark:text-white/90">
              {tenant?.name || "Your store"}
            </h1>
            {subtitle && (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200/80 dark:bg-white/5 dark:text-gray-400 dark:ring-white/10">
                <FiClock aria-hidden className="size-3 text-accent-500" />
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          {actions.length > 0 && (
            <nav aria-label="Quick actions" className="flex flex-wrap items-center gap-2">
              {actions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="shine group inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-b from-accent-500 to-accent-600 pl-2 pr-3.5 text-sm font-semibold text-white shadow-[0_6px_14px_-6px_rgba(15,157,99,0.75)] ring-1 ring-inset ring-white/15 transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-400 hover:to-accent-600 hover:shadow-[0_10px_20px_-8px_rgba(15,157,99,0.85)] focus:outline-none focus-visible:ring-3 focus-visible:ring-accent-500/40 active:translate-y-0 active:scale-[0.97]"
                >
                  <span className="flex size-7 items-center justify-center rounded-lg bg-white/15 text-[15px] transition-colors group-hover:bg-white/25">
                    {a.icon}
                  </span>
                  {a.label}
                  <FiArrowUpRight aria-hidden className="size-3.5 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              ))}
            </nav>
          )}
          {actions.length > 0 && toolbar && <span aria-hidden className="hidden h-8 w-px bg-gray-200 xl:block dark:bg-white/10" />}
          {toolbar && <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-wrap">{toolbar}</div>}
        </div>
      </div>
    </section>
  );
};

export default WelcomeBar;
