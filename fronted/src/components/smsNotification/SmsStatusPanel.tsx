import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FaUsers,
  FaCheckCircle,
  FaTimesCircle,
  FaPaperPlane,
  FaSync,
} from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import SmsCampaignTable, { Campaign } from "./SmsCampaignTable";

// ---------- Stat Card ----------
function StatCard({
  label,
  value,
  icon,
  colorClass,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
      <span
        className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-lg ${colorClass}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>
        )}
      </div>
    </div>
  );
}

// ---------- Component ----------
export default function SmsStatusPanel() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<{
    campaigns: Campaign[];
  }>({
    queryKey: ["sms-status-all"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/sms/campaigns");
      return data.data as { campaigns: Campaign[] };
    },
    staleTime: 30 * 1000,
  });

  const campaigns = data?.campaigns ?? [];

  const stats = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const totalRecipients = campaigns.reduce((s, c) => s + (c.totalCount || 0), 0);
    const totalSent = campaigns.reduce((s, c) => s + (c.sentCount || 0), 0);
    const totalFailed = campaigns.reduce((s, c) => s + (c.failedCount || 0), 0);
    const successRate =
      totalRecipients > 0 ? Math.round((totalSent / totalRecipients) * 100) : 0;
    const byStatus = campaigns.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalCampaigns,
      totalRecipients,
      totalSent,
      totalFailed,
      successRate,
      byStatus,
    };
  }, [campaigns]);

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            SMS Campaign Status
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Real-time overview of all SMS campaigns and delivery performance.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh"
          className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 disabled:opacity-50"
        >
          <FaSync className={`text-sm ${isFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* ---- Stat Cards ---- */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-10 text-red-500">
          Failed to load data.{" "}
          <button onClick={() => refetch()} className="underline font-semibold">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Campaigns"
              value={stats.totalCampaigns}
              icon={<FaPaperPlane />}
              colorClass="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
            />
            <StatCard
              label="Total Recipients"
              value={stats.totalRecipients}
              icon={<FaUsers />}
              colorClass="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
            />
            <StatCard
              label="Successfully Sent"
              value={stats.totalSent}
              icon={<FaCheckCircle />}
              colorClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
              sub={`${stats.successRate}% success rate`}
            />
            <StatCard
              label="Total Failed"
              value={stats.totalFailed}
              icon={<FaTimesCircle />}
              colorClass="bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
            />
          </div>

          {/* ---- Status breakdown ---- */}
          {stats.totalCampaigns > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(
                [
                  ["queued", "Queued", "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"],
                  ["processing", "Processing", "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"],
                  ["completed", "Completed", "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"],
                  ["partial", "Partial", "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"],
                  ["failed", "Failed", "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"],
                ] as const
              ).map(([key, label, cls]) => (
                <div
                  key={key}
                  className={`rounded-2xl border border-gray-100 dark:border-gray-800 px-4 py-3 text-center ${cls.split(" ").slice(0, 1).join(" ").replace("bg-", "bg-").replace("-50", "-50/30")}`}
                >
                  <p className={`text-2xl font-bold ${cls.split(" ").slice(1).join(" ")}`}>
                    {(stats.byStatus[key] ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* ---- Overall progress bar ---- */}
          {stats.totalRecipients > 0 && (
            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Overall Delivery Rate
                </p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.successRate}%
                </p>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                <div
                  className="h-full rounded-l-full bg-emerald-500 transition-all duration-700"
                  style={{
                    width: `${Math.round((stats.totalSent / stats.totalRecipients) * 100)}%`,
                  }}
                />
                <div
                  className="h-full bg-red-400 transition-all duration-700"
                  style={{
                    width: `${Math.round((stats.totalFailed / stats.totalRecipients) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center gap-5 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-emerald-500" />
                  Delivered ({stats.totalSent.toLocaleString()})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-red-400" />
                  Failed ({stats.totalFailed.toLocaleString()})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
                  Pending (
                  {(
                    stats.totalRecipients -
                    stats.totalSent -
                    stats.totalFailed
                  ).toLocaleString()}
                  )
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- Campaign table ---- */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          All Campaigns
        </h4>
        <SmsCampaignTable showFilters={true} />
      </div>
    </div>
  );
}
