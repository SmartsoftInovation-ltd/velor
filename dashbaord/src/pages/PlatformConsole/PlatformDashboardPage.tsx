import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { FiAlertTriangle, FiCalendar, FiDollarSign, FiRepeat, FiSearch, FiUsers } from "react-icons/fi";
import { useTheme } from "../../context/ThemeContext";
import { dashboardApi, type PlatformDashboard } from "../../platform/endpoints";
import type { BillingCycle } from "../../platform/types";
import SellerStatusBadge from "./SellerStatusBadge";
import { cardClass, Chip, ConsoleHeader, EmptyState, FilterPills, formatDate, RefreshButton, type PillOption } from "./ui";

// Platform Console home: what the platform has sold to sellers, what it earns
// per month, whose renewal is coming up, and who the sellers are. Prices and
// renewal dates come from each seller's Billing card.

type Seller = PlatformDashboard["list"][number];
type ListFilter = "all" | "renewing" | "overdue" | "unbilled";

const taka = (n: number) => `৳${Math.round(n).toLocaleString("en-US")}`;
const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n);

const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: "Monthly", yearly: "Yearly", "one-time": "One-time" };

const Kpi = ({ icon, label, value, sub, tone = "green" }: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: ReactNode;
  tone?: "green" | "amber" | "red";
}) => {
  const toneClass = {
    green: "bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400",
    amber: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400",
    red: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400",
  }[tone];
  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center gap-2.5 text-sm font-medium text-gray-500 dark:text-gray-400">
        <span className={`flex size-8 items-center justify-center rounded-lg ${toneClass}`}>{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums dark:text-white/90">{value}</p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
};

// "in 12 days", "today", "5 days overdue"
const RenewalCell = ({ seller }: { seller: Seller }) => {
  if (seller.cycle === "one-time") return <span className="text-gray-400">One-time</span>;
  if (!seller.renewsAt || seller.daysLeft === null) return <span className="text-gray-400">Not set</span>;
  const d = seller.daysLeft;
  const when =
    d < 0 ? `${-d} day${d === -1 ? "" : "s"} overdue` : d === 0 ? "today" : `in ${d} day${d === 1 ? "" : "s"}`;
  const tone =
    seller.status !== "active"
      ? "text-gray-500 dark:text-gray-400"
      : d < 0
        ? "text-error-600 dark:text-error-400"
        : d <= 7
          ? "text-warning-600 dark:text-warning-400"
          : "text-gray-500 dark:text-gray-400";
  return (
    <div>
      <p className="text-gray-800 dark:text-gray-200">{formatDate(seller.renewsAt)}</p>
      <p className={`text-xs font-medium ${tone}`}>{when}</p>
    </div>
  );
};

const SalesChart = ({ months }: { months: PlatformDashboard["salesByMonth"] }) => {
  const { theme } = useTheme();
  const dark = theme === "dark";
  const muted = dark ? "#98a2b3" : "#667085";
  const label = (key: string) =>
    new Date(`${key}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

  const options: ApexOptions = {
    chart: { type: "bar", fontFamily: "Outfit, sans-serif", toolbar: { show: false }, background: "transparent" },
    theme: { mode: dark ? "dark" : "light" },
    colors: ["#0F9D63"],
    plotOptions: { bar: { borderRadius: 4, columnWidth: "45%" } },
    dataLabels: { enabled: false },
    grid: { borderColor: dark ? "rgba(255,255,255,0.08)" : "#f1f1f4", strokeDashArray: 4 },
    xaxis: {
      categories: months.map((m) => label(m.month)),
      labels: { style: { colors: muted, fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: muted, fontSize: "11px" }, formatter: (v: number) => compact(Math.round(v)) } },
    tooltip: {
      theme: dark ? "dark" : "light",
      y: {
        formatter: (v: number, opts) => {
          const n = months[opts?.dataPointIndex ?? 0]?.sellers ?? 0;
          return `${taka(v)} · ${n} seller${n === 1 ? "" : "s"}`;
        },
      },
    },
  };

  return <Chart options={options} series={[{ name: "Sold", data: months.map((m) => m.amount) }]} type="bar" height={260} />;
};

const matches = (seller: Seller, filter: ListFilter, search: string) => {
  const q = search.trim().toLowerCase();
  if (
    q &&
    ![seller.name, seller.slug, seller.owner?.name, seller.owner?.phone, seller.owner?.email].some((v) =>
      v?.toLowerCase().includes(q),
    )
  )
    return false;
  const live = seller.status === "active";
  if (filter === "renewing") return live && seller.daysLeft !== null && seller.daysLeft >= 0 && seller.daysLeft <= 30;
  if (filter === "overdue") return live && seller.daysLeft !== null && seller.daysLeft < 0;
  if (filter === "unbilled") return seller.price === 0;
  return true;
};

const PlatformDashboardPage = () => {
  const [filter, setFilter] = useState<ListFilter>("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["platform", "dashboard"],
    queryFn: dashboardApi.get,
    staleTime: 60 * 1000,
  });

  const header = (
    <ConsoleHeader
      crumbs={[{ label: "Platform Console" }, { label: "Dashboard" }]}
      title="Dashboard"
      subtitle={data ? `Updated ${formatDate(data.generatedAt, true)}` : "Sales, sellers and renewals"}
      actions={<RefreshButton onClick={() => refetch()} spinning={isFetching} />}
    />
  );

  if (isLoading) {
    return (
      <>
        {header}
        <div className="space-y-5" aria-busy="true">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`${cardClass} h-32 animate-pulse`} />
            ))}
          </div>
          <div className={`${cardClass} h-80 animate-pulse`} />
        </div>
      </>
    );
  }
  if (isError || !data) {
    return (
      <>
        {header}
        <p className="text-sm text-error-600">Could not load the dashboard</p>
      </>
    );
  }

  const { sellers, revenue, renewals, salesByMonth, list } = data;
  const unbilled = list.filter((s) => s.price === 0).length;
  const yearTotal = salesByMonth.reduce((sum, m) => sum + m.amount, 0);
  const shown = list.filter((s) => matches(s, filter, search));
  const pills: PillOption<ListFilter>[] = [
    { value: "all", label: "All", count: list.length },
    { value: "renewing", label: `Renewing in ${renewals.windowDays} days`, count: renewals.due },
    { value: "overdue", label: "Overdue", count: renewals.overdue },
    { value: "unbilled", label: "No price set", count: unbilled },
  ];

  return (
    <>
      {header}
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            icon={<FiUsers className="size-4" />}
            label="Sellers"
            value={sellers.total.toLocaleString("en-US")}
            sub={`${sellers.byStatus.active} active · ${sellers.byStatus.suspended} suspended · ${sellers.newThisMonth} new this month`}
          />
          <Kpi
            icon={<FiRepeat className="size-4" />}
            label="Monthly recurring"
            value={taka(revenue.monthlyRecurring)}
            sub={`${taka(revenue.yearlyRecurring)} a year from active sellers`}
          />
          <Kpi
            icon={<FiDollarSign className="size-4" />}
            label="Sold this month"
            value={taka(revenue.soldThisMonth)}
            sub={`${taka(revenue.oneTimeTotal)} in one-time sales overall`}
          />
          <Kpi
            icon={renewals.overdue ? <FiAlertTriangle className="size-4" /> : <FiCalendar className="size-4" />}
            label="Renewals"
            tone={renewals.overdue ? "red" : renewals.due ? "amber" : "green"}
            value={`${renewals.due} due`}
            sub={
              renewals.overdue
                ? `${renewals.overdue} overdue (${taka(renewals.overdueAmount)}) · ${taka(renewals.dueAmount)} due in ${renewals.windowDays} days`
                : `${taka(renewals.dueAmount)} due in the next ${renewals.windowDays} days`
            }
          />
        </div>

        <section className={`${cardClass} p-5`}>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white/90">Sales to sellers, last 12 months</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Each seller counts in the month they were sold, at their price</p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 tabular-nums dark:text-white/90">{taka(yearTotal)}</span> total
            </p>
          </div>
          {yearTotal === 0 ? (
            <EmptyState
              icon={<FiDollarSign />}
              title="No sales recorded yet"
              text="Set a price and a sold date on each seller's Billing card (Sellers → a seller) to see sales here."
            />
          ) : (
            <SalesChart months={salesByMonth} />
          )}
        </section>

        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-col gap-3 p-5 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <FilterPills options={pills} value={filter} onChange={setFilter} />
            <div className="relative w-full lg:w-72">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search seller, owner or phone"
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/15 dark:border-gray-800 dark:bg-gray-900 dark:text-white/90"
              />
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState icon={<FiUsers />} title="No sellers here" text="Nothing matches this filter." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-y border-gray-100 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
                    <th className="px-5 py-2.5">Seller</th>
                    <th className="px-5 py-2.5">Owner</th>
                    <th className="px-5 py-2.5">Status</th>
                    <th className="px-5 py-2.5 text-right">Price</th>
                    <th className="px-5 py-2.5">Sold on</th>
                    <th className="px-5 py-2.5">Renews</th>
                    <th className="px-5 py-2.5 text-right">Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s._id} className="border-b border-gray-50 align-top last:border-0 hover:bg-gray-50/70 dark:border-gray-800/60 dark:hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <Link to={`/platform/sellers/${s._id}`} className="font-semibold text-gray-900 hover:text-accent-600 dark:text-white/90">
                          {s.name}
                        </Link>
                        <p className="font-mono text-xs text-gray-400">{s.slug}</p>
                      </td>
                      <td className="max-w-[220px] px-5 py-3">
                        {s.owner ? (
                          <>
                            <p className="truncate text-gray-800 dark:text-gray-200" title={s.owner.name}>{s.owner.name}</p>
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={s.owner.email}>
                              {s.owner.phone}
                            </p>
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <SellerStatusBadge status={s.status} />
                      </td>
                      <td className="px-5 py-3 text-right">
                        {s.price ? (
                          <>
                            <p className="font-semibold tabular-nums text-gray-900 dark:text-white/90">{taka(s.price)}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{CYCLE_LABEL[s.cycle]}</p>
                          </>
                        ) : (
                          <Chip tone="gray">Not set</Chip>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatDate(s.startedAt ?? s.createdAt)}</td>
                      <td className="px-5 py-3">
                        <RenewalCell seller={s} />
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {s.staff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default PlatformDashboardPage;
