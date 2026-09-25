import { Fragment, useState } from "react";
import type { IconType } from "react-icons";
import {
  FaLayerGroup,
  FaBoxOpen,
  FaShoppingCart,
  FaUserFriends,
  FaTicketAlt,
  FaWarehouse,
  FaUserShield,
  FaListUl,
  FaPlus,
  FaPen,
  FaTrash,
  FaSignInAlt,
  FaSignOutAlt,
  FaTimesCircle,
  FaExchangeAlt,
  FaCoins,
  FaUndoAlt,
  FaChevronDown,
  FaHistory,
  FaTimes,
} from "react-icons/fa";
import PickerSelect from "../sales/PickerSelect";
import { useInfiniteQuery } from "@tanstack/react-query";
import moment from "moment";
import axiosSecure from "../../hooks/useAxiosSecure";

interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

interface AuditLogEntry {
  _id: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    roles?: string[];
  };
  action: string;
  entity: {
    type: string;
    id?: string;
    label?: string;
  };
  changes?: AuditChange[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  meta?: {
    ip?: string;
    userAgent?: string;
    method?: string;
    path?: string;
  };
  createdAt: string;
}

interface AuditLogResponse {
  logs: AuditLogEntry[];
  nextCursor: string | null;
  actions: string[];
}

const ENTITY_TYPES = [
  { value: "", label: "All Entities" },
  { value: "product", label: "Product" },
  { value: "order", label: "Order" },
  { value: "customer", label: "Customer" },
  { value: "coupon", label: "Coupon" },
  { value: "stockadjust", label: "Stock Adjustment" },
  { value: "user", label: "User" },
];

const ACTIONS = [
  "",
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "STATUS_CHANGE",
  "STOCK_ADJUST",
  "PAYMENT",
  "REFUND",
];

const ACTION_BADGE: Record<string, string> = {
  CREATE: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  UPDATE: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  DELETE: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  LOGIN: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  LOGIN_FAILED: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  LOGOUT: "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400",
  STATUS_CHANGE: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  STOCK_ADJUST: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-400",
  PAYMENT: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  REFUND: "bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
};

const ENTITY_ICONS: Record<string, IconType> = {
  "": FaLayerGroup,
  product: FaBoxOpen,
  order: FaShoppingCart,
  customer: FaUserFriends,
  coupon: FaTicketAlt,
  stockadjust: FaWarehouse,
  user: FaUserShield,
};

const ACTION_META: Record<string, { icon: IconType; tone: string }> = {
  "": { icon: FaListUl, tone: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300" },
  CREATE: { icon: FaPlus, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
  UPDATE: { icon: FaPen, tone: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" },
  DELETE: { icon: FaTrash, tone: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" },
  LOGIN: { icon: FaSignInAlt, tone: "bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400" },
  LOGIN_FAILED: { icon: FaTimesCircle, tone: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400" },
  LOGOUT: { icon: FaSignOutAlt, tone: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300" },
  STATUS_CHANGE: { icon: FaExchangeAlt, tone: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400" },
  STOCK_ADJUST: { icon: FaWarehouse, tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" },
  PAYMENT: { icon: FaCoins, tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
  REFUND: { icon: FaUndoAlt, tone: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400" },
};

const inputClass =
  "h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200";

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function DiffView({ log }: { log: AuditLogEntry }) {
  if (log.changes && log.changes.length > 0) {
    return (
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <th className="py-1.5 pr-4 font-medium w-1/4">Field</th>
            <th className="py-1.5 pr-4 font-medium">Before</th>
            <th className="py-1.5 font-medium">After</th>
          </tr>
        </thead>
        <tbody>
          {log.changes.map((change) => (
            <tr
              key={change.field}
              className="border-t border-gray-100 dark:border-gray-800"
            >
              <td className="py-1.5 pr-4 font-mono text-gray-600 dark:text-gray-300">
                {change.field}
              </td>
              <td className="py-1.5 pr-4 break-all">
                <span className="rounded-md bg-error-50 px-1.5 py-0.5 text-error-700 dark:bg-error-500/15 dark:text-error-400">
                  {formatValue(change.before)}
                </span>
              </td>
              <td className="py-1.5 break-all">
                <span className="rounded-md bg-accent-50 px-1.5 py-0.5 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                  {formatValue(change.after)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const snapshot = log.after || log.before;
  if (!snapshot) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500">
        No state captured for this event.
      </p>
    );
  }
  return (
    <pre className="max-h-64 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
      {JSON.stringify(snapshot, null, 2)}
    </pre>
  );
}

const AuditLogTable = () => {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["audit-logs", entityType, action, from, to],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", moment(to).endOf("day").toISOString());
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "50");
      const { data: res } = await axiosSecure.get(
        `/audit?${params.toString()}`,
      );
      return res.data as AuditLogResponse;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30 * 1000,
  });

  const logs = data?.pages.flatMap((page) => page.logs) ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/[0.03] p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Entity
          </label>
          <PickerSelect
            options={ENTITY_TYPES.map((entity) => ({
              value: entity.value,
              label: entity.label,
              icon: ENTITY_ICONS[entity.value] ?? FaLayerGroup,
            }))}
            value={entityType}
            onChange={setEntityType}
            placeholder="All Entities"
            size="md"
            placement="bottom"
            className="w-60"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Action
          </label>
          <PickerSelect
            options={ACTIONS.map((act) => ({
              value: act,
              label: act || "All Actions",
              icon: ACTION_META[act]?.icon ?? FaListUl,
              tone: ACTION_META[act]?.tone,
            }))}
            value={action}
            onChange={setAction}
            placeholder="All Actions"
            size="md"
            placement="bottom"
            className="w-60"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            From
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            To
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </div>
        {(entityType || action || from || to) && (
          <button
            type="button"
            onClick={() => {
              setEntityType("");
              setAction("");
              setFrom("");
              setTo("");
            }}
            className="shine flex items-center gap-1.5 h-10 px-3 rounded-xl bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25 text-xs font-medium transition-colors"
          >
            <FaTimes className="size-3" />
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      ) : isError ? (
        <div className="py-20 text-center">
          <p className="mb-4 font-bold text-red-500">
            Error fetching audit logs!
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="shine rounded-xl bg-accent-500 hover:bg-accent-600 px-6 py-2 font-bold text-white shadow-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-2xl border border-gray-200 dark:border-white/[0.05]">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-full bg-accent-500/10 blur-2xl" />
            <div className="relative size-20 rounded-full bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center ring-8 ring-gray-50 dark:ring-gray-800/40">
              <FaHistory className="size-8 text-gray-300 dark:text-gray-600" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1">No Activity Found</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            No audit logs match the selected filters.
          </p>
        </div>
      ) : (
        <div className="no-scrollbar overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] shadow-theme-sm">
          <table className="w-full min-w-175 text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/95 text-left text-[11px] uppercase text-gray-500 dark:border-white/[0.05] dark:bg-gray-800/95 dark:text-gray-400">
                <th className="px-4 py-4 font-bold">Time</th>
                <th className="px-4 py-4 font-bold">User</th>
                <th className="px-4 py-4 font-bold">Action</th>
                <th className="px-4 py-4 font-bold">Entity</th>
                <th className="px-4 py-4 font-bold">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <Fragment key={log._id}>
                  <tr
                    onClick={() =>
                      setExpandedId(expandedId === log._id ? null : log._id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedId(expandedId === log._id ? null : log._id);
                      }
                    }}
                    tabIndex={0}
                    aria-expanded={expandedId === log._id}
                    className={`cursor-pointer border-b border-gray-100 transition-colors focus-visible:outline-none focus-visible:bg-accent-50/60 dark:border-white/[0.05] ${
                      expandedId === log._id
                        ? "bg-accent-50/40 dark:bg-accent-500/5"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                      <div>{moment(log.createdAt).format("DD MMM YYYY")}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        {moment(log.createdAt).format("hh:mm:ss A")}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-8 shrink-0 rounded-full bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400 flex items-center justify-center text-xs font-bold uppercase">
                          {(log.user?.name || log.user?.email || "S").charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-700 dark:text-gray-200 truncate">
                            {log.user?.name || log.user?.email || "System / Guest"}
                          </div>
                          {log.user?.roles && log.user.roles.length > 0 && (
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {log.user.roles.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-current/15 ${
                          ACTION_BADGE[log.action] ||
                          "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium capitalize text-gray-700 dark:text-gray-200">
                        {log.entity.type}
                      </div>
                      {log.entity.label && (
                        <div className="max-w-50 truncate text-xs text-gray-400 dark:text-gray-500">
                          {log.entity.label}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {log.changes && log.changes.length > 0
                        ? `${log.changes.length} field${log.changes.length > 1 ? "s" : ""} changed`
                        : log.after || log.before
                          ? "Snapshot"
                          : "—"}
                      <FaChevronDown
                        aria-hidden
                        className={`ml-2 inline size-3 text-accent-500 transition-transform ${
                          expandedId === log._id ? "rotate-180" : ""
                        }`}
                      />
                    </td>
                  </tr>
                  {expandedId === log._id && (
                    <tr
                      key={`${log._id}-detail`}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <td
                        colSpan={5}
                        className="bg-gray-50/60 px-6 py-4 dark:bg-white/[0.02] border-l-2 border-accent-500"
                      >
                        <DiffView log={log} />
                        {log.meta?.ip && (
                          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                            IP: {log.meta.ip}
                            {log.meta.path &&
                              ` · ${log.meta.method} ${log.meta.path}`}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cursor pagination */}
      {hasNextPage && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            type="button"
            className="shine flex items-center gap-2 rounded-xl border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 px-6 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {isFetchingNextPage ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-accent-500/20 border-t-accent-500" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogTable;
