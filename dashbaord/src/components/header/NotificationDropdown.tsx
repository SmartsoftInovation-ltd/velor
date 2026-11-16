import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dropdown } from "../ui/dropdown/Dropdown";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useAuth } from "../../context/AuthContext";
import { initSocket } from "../../socket/socket";

type WebOrderNotification = {
  _id: string;
  invoiceId: string | null;
  customerName: string;
  phone: string;
  amount: number;
  quantity: number;
  createdAt: string;
};

type Feed = { count: number; notifications: WebOrderNotification[] };

const QUERY_KEY = ["webOrderNotifications"];
const EMPTY: Feed = { count: 0, notifications: [] };

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * The header bell: storefront orders no one in the store has opened yet.
 * A new web order raises the count live (socket "orderPlaced"); opening one
 * from the list marks it seen for the whole store and goes to the order.
 */
export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const allowed = can("order", "view");

  const { data = EMPTY } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await axiosSecure.get("/order/web-notifications")).data.data as Feed,
    enabled: allowed,
    staleTime: 30 * 1000,
    // A fallback for a dropped socket
    refetchInterval: 2 * 60 * 1000,
  });

  // New orders, and orders another staff member opened, update the bell at once
  useEffect(() => {
    if (!allowed) return;
    const socket = initSocket();
    const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    socket.on("orderPlaced", refresh);
    socket.on("webOrderSeen", refresh);
    return () => {
      socket.off("orderPlaced", refresh);
      socket.off("webOrderSeen", refresh);
    };
  }, [allowed, queryClient]);

  // Drop the order from the bell straight away, then tell the server
  const markSeen = (id?: string) => {
    queryClient.setQueryData<Feed>(QUERY_KEY, (feed = EMPTY) =>
      id
        ? { count: Math.max(0, feed.count - 1), notifications: feed.notifications.filter((n) => n._id !== id) }
        : EMPTY,
    );
    const url = id ? `/order/web-notifications/${id}/seen` : "/order/web-notifications/seen-all";
    axiosSecure
      .patch(url)
      .catch(() => undefined)
      .finally(() => queryClient.invalidateQueries({ queryKey: QUERY_KEY }));
  };

  const openOrder = (id: string) => {
    markSeen(id);
    setIsOpen(false);
    navigate(`/orderdetails/${id}`);
  };

  if (!allowed) return null;

  const { count, notifications } = data;
  const badge = count > 99 ? "99+" : String(count);

  return (
    <div className="relative">
      {/* no-shine: the global shine sweep sets overflow:hidden, which would clip the count badge */}
      <button
        type="button"
        aria-label={count ? `${count} new web orders` : "Notifications"}
        aria-expanded={isOpen}
        className="header-icon-button dropdown-toggle no-shine overflow-visible text-gray-600 hover:bg-brand-50 hover:text-[#0A6B43] dark:text-gray-300 dark:hover:bg-[#B8E4CF]/15 dark:hover:text-[#0A6B43]"
        onClick={() => setIsOpen((open) => !open)}
      >
        {count > 0 ? (
          <span className="absolute -right-2 -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-gray-800">
            <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-40" aria-hidden="true" />
            <span className="relative">{badge}</span>
          </span>
        ) : null}
        <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute -right-[240px] mt-[17px] flex max-h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
          <h5 className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-200">
            Web orders
            {count > 0 ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-500/15 dark:text-red-400">
                {count} new
              </span>
            ) : null}
          </h5>
          {count > 0 ? (
            <button
              type="button"
              onClick={() => markSeen()}
              className="text-xs font-medium text-accent-600 hover:underline dark:text-accent-400"
            >
              Mark all as read
            </button>
          ) : null}
        </div>

        {notifications.length ? (
          <ul className="custom-scrollbar flex flex-col overflow-y-auto">
            {notifications.map((n) => (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={() => openOrder(n._id)}
                  className="flex w-full gap-3 rounded-lg border-b border-gray-100 px-3 py-3 text-left hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <path d="M3 6h18" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-800 dark:text-white/90">{n.customerName || "A shopper"}</span>
                      {" placed order "}
                      <span className="font-medium text-gray-800 dark:text-white/90">{n.invoiceId || "—"}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">৳{n.amount.toLocaleString()}</span>
                      <span className="h-1 w-1 rounded-full bg-gray-400" />
                      <span>
                        {n.quantity} item{n.quantity === 1 ? "" : "s"}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-gray-400" />
                      <span>{timeAgo(n.createdAt)}</span>
                    </span>
                  </span>
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="text-3xl" aria-hidden="true">🔔</span>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">You're all caught up</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">New orders from your website will show here.</p>
          </div>
        )}

        <Link
          to="/order-list"
          onClick={() => setIsOpen(false)}
          className="shine mt-3 block rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          View all web orders
        </Link>
      </Dropdown>
    </div>
  );
}
