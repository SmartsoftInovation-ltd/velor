import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FaEnvelope, FaEnvelopeOpen, FaEye } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import ListEmptyState from "../../common/ListEmptyState";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

export interface ContactMessage {
  _id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

type Status = "" | "unread" | "read";

const formatDate = (value?: string) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const formatTime = (value?: string) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
};

const ReadPill = ({ isRead }: { isRead: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
      isRead
        ? "bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-white/5 dark:text-gray-400"
        : "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
    }`}
  >
    <span className={`size-1.5 rounded-full ${isRead ? "bg-gray-400" : "bg-accent-500 animate-pulse"}`} />
    {isRead ? "Read" : "New"}
  </span>
);

const BTN = "shine flex size-10 items-center justify-center !rounded border-none p-0 transition-all active:scale-90";
const VIEW = `${BTN} !bg-gray-100 !text-gray-600 hover:!bg-gray-200 hover:!text-gray-900 dark:!bg-white/5 dark:!text-gray-400 dark:hover:!bg-white/10`;
const TOGGLE_ON = `${BTN} !bg-accent-50 !text-accent-600 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-400 dark:hover:!bg-accent-500/25`;
const TOGGLE_OFF = `${BTN} !bg-gray-100 !text-gray-400 hover:!bg-gray-200 hover:!text-gray-500 dark:!bg-white/5 dark:!text-gray-500 dark:hover:!bg-white/10`;
const DELETE = `${BTN} !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25`;

/**
 * Messages shoppers sent from the website's Contact page, newest first.
 * Opening one marks it read; staff can flip it back or delete it.
 */
const ContactMessageTable = () => {
  const isMobile = useIsMobile();
  const canEdit = usePermission("site-information", "edit");
  const canDelete = usePermission("site-information", "delete");

  const [items, setItems] = useState<ContactMessage[]>([]);
  const [status, setStatus] = useState<Status>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ContactMessage | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosSecure.get("/contact-messages", { params: { page, status: status || undefined } });
      const data = res.data?.data;
      setItems(data?.items || []);
      setTotal(data?.total || 0);
      setUnread(data?.unread || 0);
      setTotalPages(data?.totalPages || 1);
    } catch (error) {
      showApiError(error, "Failed to load messages.");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const setRead = async (msg: ContactMessage, isRead: boolean, quiet = false) => {
    try {
      await axiosSecure.patch(`/contact-messages/${msg._id}/read`, { isRead });
      setItems((list) => list.map((m) => (m._id === msg._id ? { ...m, isRead } : m)));
      setUnread((n) => Math.max(0, n + (isRead ? -1 : 1)));
      if (!quiet) toast.success(isRead ? "Marked as read" : "Marked as unread");
    } catch (error) {
      showApiError(error, "Failed to update the message.");
    }
  };

  const view = (msg: ContactMessage) => {
    setOpen(msg);
    if (!msg.isRead && canEdit) setRead(msg, true, true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setBusy(true);
      await axiosSecure.delete(`/contact-messages/${deleteId}`);
      toast.success("Message deleted.");
      setDeleteId(null);
      load();
    } catch (error) {
      showApiError(error, "Failed to delete the message.");
    } finally {
      setBusy(false);
    }
  };

  const actions = (msg: ContactMessage) => (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => view(msg)} className={`${VIEW} max-md:size-11`} title="View" aria-label="View message">
        <FaEye className="size-4" />
      </button>
      {canEdit && (
        <button
          type="button"
          onClick={() => setRead(msg, !msg.isRead)}
          className={`${msg.isRead ? TOGGLE_OFF : TOGGLE_ON} max-md:size-11`}
          title={msg.isRead ? "Mark as unread" : "Mark as read"}
          aria-label={msg.isRead ? "Mark as unread" : "Mark as read"}
        >
          {msg.isRead ? <FaEnvelopeOpen className="size-4" /> : <FaEnvelope className="size-4" />}
        </button>
      )}
      {canDelete && (
        <button type="button" onClick={() => setDeleteId(msg._id)} className={`${DELETE} max-md:size-11`} title="Delete" aria-label="Delete message">
          <MdDelete className="size-5" />
        </button>
      )}
    </div>
  );

  const serial = (idx: number) => `#${(page - 1) * 20 + idx + 1}`;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {([["", "All"], ["unread", `New (${unread})`], ["read", "Read"]] as [Status, string][]).map(([value, label]) => (
          <button
            key={value || "all"}
            type="button"
            onClick={() => { setStatus(value); setPage(1); }}
            className={`shine rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              status === value
                ? "bg-accent-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="py-10 text-center text-sm text-gray-500">Loading…</p>}

      {!loading && items.length === 0 && (
        <ListEmptyState
          icon={<FaEnvelope />}
          title={status === "unread" ? "No new messages" : "No messages yet"}
          hint="Messages shoppers send from the website's Contact page show up here."
        />
      )}

      {!loading && items.length > 0 && isMobile ? (
        <MobileCardList
          items={items}
          getKey={(m) => m._id}
          emptyMessage="No messages"
          renderCard={(m) => (
            <div className="space-y-1">
              <div className="mb-2 flex items-center justify-between gap-3 border-b border-gray-100 pb-2 dark:border-white/[0.05]">
                <p className="min-w-0 truncate text-sm font-bold text-gray-800 dark:text-white/90">{m.name}</p>
                <ReadPill isRead={m.isRead} />
              </div>
              <MobileCardRow label="Email">{m.email}</MobileCardRow>
              <MobileCardRow label="Subject">{m.subject || "—"}</MobileCardRow>
              <MobileCardRow label="Date">
                <span className="block">{formatDate(m.createdAt)}</span>
                <span className="block text-[11px] text-gray-400 dark:text-gray-500">{formatTime(m.createdAt)}</span>
              </MobileCardRow>
              <div className="pt-2">{actions(m)}</div>
            </div>
          )}
        />
      ) : !loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <table className="w-full min-w-[900px]" style={{ tableLayout: "fixed", borderCollapse: "collapse" }}>
            <colgroup>
              <col style={{ width: "90px" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "18%" }} />
              <col />
              <col style={{ width: "130px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "160px" }} />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/[0.05]">
                {["Serial ID", "From", "Subject", "Message", "Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((m, idx) => (
                <tr key={m._id} className="border-b border-gray-100 transition-colors hover:bg-gray-50 dark:border-white/[0.05] dark:hover:bg-white/[0.02]">
                  <td className="px-3 py-3">
                    <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">{serial(idx)}</span>
                  </td>
                  <td className="px-3 py-3 text-sm">
                    <span className={`block truncate text-gray-800 dark:text-white ${m.isRead ? "font-medium" : "font-bold"}`}>{m.name}</span>
                    <a href={`mailto:${m.email}`} className="block truncate text-xs text-gray-500 hover:text-accent-600 dark:text-gray-400">{m.email}</a>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300"><span className="block truncate">{m.subject || "—"}</span></td>
                  <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300"><span className="block truncate">{m.message}</span></td>
                  <td className="px-3 py-3">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{formatDate(m.createdAt)}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{formatTime(m.createdAt)}</p>
                  </td>
                  <td className="px-3 py-3"><ReadPill isRead={m.isRead} /></td>
                  <td className="px-3 py-3">{actions(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-400 dark:border-white/[0.05]">
            <span>{total} message{total !== 1 ? "s" : ""}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/5">Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-white/5">Next</button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="contact-message-title" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h3 id="contact-message-title" className="text-lg font-semibold text-gray-800 dark:text-white">{open.subject || "No subject"}</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {open.name} · <a href={`mailto:${open.email}`} className="text-accent-600 hover:underline dark:text-accent-400">{open.email}</a>
            </p>
            <p className="text-xs text-gray-400">{formatDate(open.createdAt)} {formatTime(open.createdAt)}</p>
            <p className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-200">{open.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setOpen(null)} className="shine rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Close</button>
              <a href={`mailto:${open.email}?subject=${encodeURIComponent(`Re: ${open.subject || "Your message"}`)}`} className="shine rounded-md bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">Reply by email</a>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white">Delete Message</h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">Are you sure? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteId(null)} className="shine rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={busy} className="shine rounded-md bg-error-500 px-4 py-2 text-sm font-semibold text-white hover:bg-error-600 disabled:opacity-50">{busy ? "Deleting…" : "Yes, Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactMessageTable;
