import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaClock,
  FaSpinner,
  FaExclamationCircle,
  FaSearch,
  FaSync,
  FaTimes,
  FaUsers,
  FaShoppingCart,
  FaStore,
  FaWalking,
} from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";

// ---------- Types ----------
type RecipientType = "logged" | "order" | "sales_walking" | "sales_listed" | "due" | "";
type CampaignStatus = "queued" | "processing" | "completed" | "partial" | "failed";

export interface Campaign {
  _id: string;
  message: string;
  recipientType: RecipientType;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  status: CampaignStatus;
  sentByName: string;
  triggeredBy: string;
  createdAt: string;
  jobId?: string;
}

interface Props {
  /** If set, pre-filters by this recipient type */
  defaultFilter?: RecipientType;
  /** If true, show the filter controls */
  showFilters?: boolean;
}

// ---------- Helpers ----------
const RECIPIENT_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  logged: {
    label: "Logged Customers",
    icon: <FaUsers className="text-xs" />,
    color: "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400",
  },
  order: {
    label: "Order Customers",
    icon: <FaShoppingCart className="text-xs" />,
    color: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  },
  sales_walking: {
    label: "Walking Customers",
    icon: <FaWalking className="text-xs" />,
    color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  sales_listed: {
    label: "Listed Customers",
    icon: <FaStore className="text-xs" />,
    color: "bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400",
  },
  due: {
    label: "Due Customers",
    icon: <FaUsers className="text-xs" />,
    color: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  },
};

function RecipientBadge({ type }: { type: string }) {
  const meta = RECIPIENT_LABELS[type] || {
    label: type || "—",
    icon: <FaUsers className="text-xs" />,
    color: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.color}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const map: Record<CampaignStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    queued: {
      label: "Queued",
      icon: <FaClock className="text-xs" />,
      cls: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    },
    processing: {
      label: "Processing",
      icon: <FaSpinner className="text-xs animate-spin" />,
      cls: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    },
    completed: {
      label: "Completed",
      icon: <FaCheckCircle className="text-xs" />,
      cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    partial: {
      label: "Partial",
      icon: <FaExclamationCircle className="text-xs" />,
      cls: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
    },
    failed: {
      label: "Failed",
      icon: <FaTimesCircle className="text-xs" />,
      cls: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    },
  };
  const m = map[status] || map.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

function ProgressBar({ sent, total, failed }: { sent: number; total: number; failed: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">—</span>;
  const sentPct = Math.round((sent / total) * 100);
  const failPct = Math.round((failed / total) * 100);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{sent.toLocaleString()} sent</span>
        {failed > 0 && (
          <span className="text-red-500 dark:text-red-400 font-medium">{failed.toLocaleString()} failed</span>
        )}
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${sentPct}%` }}
        />
        <div
          className="h-full bg-red-400 transition-all"
          style={{ width: `${failPct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-0.5">{sentPct}% delivered</p>
    </div>
  );
}

export default function SmsCampaignTable({ defaultFilter = "", showFilters = true }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<RecipientType>(defaultFilter);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ["sms-campaigns", typeFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (typeFilter) params.recipientType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await axiosSecure.get("/sms/campaigns", { params });
      return data.data as { campaigns: Campaign[] };
    },
    staleTime: 30 * 1000,
  });

  const campaigns = data?.campaigns ?? [];

  const filtered = campaigns.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.message.toLowerCase().includes(q) ||
      (c.sentByName || c.triggeredBy || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* ---- Toolbar ---- */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input
              type="text"
              placeholder="Search message, sent by…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xs" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RecipientType)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Recipient Types</option>
            <option value="logged">Logged Customers</option>
            <option value="order">Order Customers</option>
            <option value="sales">Sales Customers</option>
            <option value="due">Due Customers</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "")}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="partial">Partial</option>
            <option value="failed">Failed</option>
          </select>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 disabled:opacity-50"
            title="Refresh"
          >
            <FaSync className={`text-sm ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}

      {/* ---- Table ---- */}
      {isLoading ? (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-20">
          <p className="text-red-500 font-bold mb-4">Failed to load SMS campaigns.</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold"
          >
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <FaSpinner className="mx-auto mb-3 text-3xl opacity-30" />
          <p className="font-medium">No campaigns found.</p>
          <p className="text-sm mt-1">SMS campaigns will appear here after you send bulk messages.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
            style={{ gridTemplateColumns: "1fr 160px 120px 200px 120px 120px" }}
          >
            <div>Message</div>
            <div>Recipient Type</div>
            <div>Total</div>
            <div>Delivery</div>
            <div>Sent By</div>
            <div>Status</div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((c) => (
              <div key={c._id} className="group">
                {/* Row */}
                <button
                  className="w-full text-left px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  onClick={() => setExpanded(expanded === c._id ? null : c._id)}
                >
                  <div
                    className="hidden md:grid items-center gap-4"
                    style={{ gridTemplateColumns: "1fr 160px 120px 200px 120px 120px" }}
                  >
                    {/* Message */}
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-white line-clamp-1">
                        {c.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(c.createdAt).toLocaleString("en-BD")}
                      </p>
                    </div>
                    {/* Recipient */}
                    <div>
                      <RecipientBadge type={c.recipientType} />
                    </div>
                    {/* Total */}
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      {c.totalCount.toLocaleString()}
                    </div>
                    {/* Progress */}
                    <div>
                      <ProgressBar sent={c.sentCount} total={c.totalCount} failed={c.failedCount} />
                    </div>
                    {/* Sent By */}
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {c.sentByName || c.triggeredBy || "admin"}
                    </div>
                    {/* Status */}
                    <div>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>

                  {/* Mobile card */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-white line-clamp-2 flex-1">
                        {c.message}
                      </p>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <RecipientBadge type={c.recipientType} />
                      <span className="text-xs text-gray-400">
                        {c.totalCount.toLocaleString()} recipients
                      </span>
                    </div>
                    <ProgressBar sent={c.sentCount} total={c.totalCount} failed={c.failedCount} />
                  </div>
                </button>

                {/* Expanded detail */}
                {expanded === c._id && (
                  <div className="px-5 pb-4 bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-700 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      <Detail label="Full Message" value={c.message} mono />
                      <Detail label="Campaign ID" value={c._id} mono />
                      <Detail label="Job ID" value={c.jobId || "—"} mono />
                      <Detail label="Sent By" value={c.sentByName || c.triggeredBy || "admin"} />
                      <Detail
                        label="Sent At"
                        value={new Date(c.createdAt).toLocaleString("en-BD", {
                          dateStyle: "medium",
                          timeStyle: "medium",
                        })}
                      />
                      <Detail label="Total Recipients" value={c.totalCount.toLocaleString()} />
                      <Detail
                        label="Successfully Sent"
                        value={c.sentCount.toLocaleString()}
                        highlight="green"
                      />
                      <Detail
                        label="Failed"
                        value={c.failedCount.toLocaleString()}
                        highlight={c.failedCount > 0 ? "red" : undefined}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
            Showing {filtered.length} of {campaigns.length} campaigns
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "green" | "red";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <span
        className={`text-sm break-all ${
          mono ? "font-mono text-gray-600 dark:text-gray-300" : ""
        } ${
          highlight === "green"
            ? "text-emerald-600 dark:text-emerald-400 font-semibold"
            : highlight === "red"
            ? "text-red-500 dark:text-red-400 font-semibold"
            : "text-gray-800 dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
