import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import moment from "moment";
import { FaEye, FaTimes } from "react-icons/fa";

// ---------- Types ----------
export interface SmsCampaign {
  _id: string;
  recipientType: "logged" | "order" | "sales_walking" | "sales_listed" | "due";
  message: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  status: "queued" | "processing" | "completed" | "partial" | "failed";
  sentByName?: string;
  triggeredBy?: string;
  createdAt: string;
}

interface Props {
  campaigns: SmsCampaign[] | null;
}

const RECIPIENT_LABELS: Record<string, string> = {
  logged: "Logged Customers",
  order: "Order Customers",
  sales_walking: "Walking Customers",
  sales_listed: "Listed Customers",
  due: "Due Customers",
};

const statusStyle: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  partial: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  processing: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  queued: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  failed: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
};

// Header and rows share this template. minmax(0, ...) keeps the flexible
// columns the same width whatever the content: a plain fr grows to fit a long
// value, and as rows swap in while scrolling they drifted out of line with the
// headings. Long values are cut with an ellipsis and shown in full on hover.
const gridTemplateColumns =
  "150px minmax(0, 1fr) minmax(0, 1.4fr) 90px 90px 90px 120px 110px 56px";
const HEADERS = [
  "Date",
  "Recipient Type",
  "SMS Content",
  "Total",
  "Sent",
  "Failed",
  "Sent By",
  "Status",
  "",
];

const SmsCampaignTable = ({ campaigns }: Props) => {
  const rows = campaigns || [];
  const parentRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<SmsCampaign | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 text-gray-400 dark:border-gray-800">
        <p className="text-sm font-medium">No SMS campaigns found.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
        {/* Header */}
        <div
          className="grid bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/[0.03] dark:text-gray-400"
          style={{ gridTemplateColumns }}
        >
          {HEADERS.map((h, i) => (
            <div key={i} className="min-w-0 truncate px-3 py-3" title={h || undefined}>
              {h}
            </div>
          ))}
        </div>

        {/* Body */}
        <div
          ref={parentRef}
          className="overflow-y-auto"
          style={{ maxHeight: 620 }}
        >
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const c = rows[virtualRow.index];
              return (
                <div
                  key={c._id}
                  className="absolute left-0 top-0 grid w-full items-center border-t border-gray-100 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300"
                  style={{
                    gridTemplateColumns,
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="min-w-0 truncate px-3 py-2 text-xs">
                    {moment(c.createdAt).format("DD MMM YYYY")}
                    <div className="text-[11px] text-gray-400">
                      {moment(c.createdAt).format("hh:mm A")}
                    </div>
                  </div>
                  <div
                    className="min-w-0 truncate px-3 py-2"
                    title={RECIPIENT_LABELS[c.recipientType] || c.recipientType}
                  >
                    {RECIPIENT_LABELS[c.recipientType] || c.recipientType}
                  </div>
                  <div className="min-w-0 truncate px-3 py-2" title={c.message}>
                    {c.message}
                  </div>
                  <div className="min-w-0 truncate px-3 py-2 font-semibold">{c.totalCount}</div>
                  <div className="min-w-0 truncate px-3 py-2 font-semibold text-emerald-600">
                    {c.sentCount}
                  </div>
                  <div className="min-w-0 truncate px-3 py-2 font-semibold text-red-500">
                    {c.failedCount}
                  </div>
                  <div className="min-w-0 truncate px-3 py-2 text-xs" title={c.sentByName || c.triggeredBy || "admin"}>
                    {c.sentByName || c.triggeredBy || "admin"}
                  </div>
                  <div className="min-w-0 px-3 py-2" title={c.status}>
                    <span
                      className={`inline-flex max-w-full rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                        statusStyle[c.status] || statusStyle.queued
                      }`}
                    >
                      <span className="min-w-0 truncate">{c.status}</span>
                    </span>
                  </div>
                  <div className="min-w-0 px-2 py-2">
                    <button
                      onClick={() => setPreview(c)}
                      className="flex size-8 items-center justify-center rounded-xl bg-brand-500 text-white transition-colors hover:bg-brand-600"
                      title="View content"
                    >
                      <FaEye className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Campaign Details
              </h4>
              <button
                onClick={() => setPreview(null)}
                className="flex size-8 items-center justify-center rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
              >
                <FaTimes className="size-3.5" />
              </button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Recipient Type</dt>
                <dd className="font-medium text-gray-800 dark:text-white/90">
                  {RECIPIENT_LABELS[preview.recipientType] || preview.recipientType}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Total / Sent / Failed</dt>
                <dd className="font-medium text-gray-800 dark:text-white/90">
                  {preview.totalCount} / {preview.sentCount} / {preview.failedCount}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium capitalize text-gray-800 dark:text-white/90">
                  {preview.status}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Sent By</dt>
                <dd className="font-medium text-gray-800 dark:text-white/90">
                  {preview.sentByName || preview.triggeredBy || "admin"}
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <dt className="text-gray-500">Date</dt>
                <dd className="font-medium text-gray-800 dark:text-white/90">
                  {moment(preview.createdAt).format("DD MMM YYYY, hh:mm A")}
                </dd>
              </div>
              <div>
                <dt className="mb-1 text-gray-500">SMS Content</dt>
                <dd className="rounded-xl bg-gray-50 p-3 text-gray-800 dark:bg-white/[0.03] dark:text-gray-200">
                  {preview.message}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsCampaignTable;
