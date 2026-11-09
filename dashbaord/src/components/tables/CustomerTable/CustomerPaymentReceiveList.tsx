import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import toast from "react-hot-toast";
import moment from "moment";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { MdDelete } from "react-icons/md";
import { FaEdit, FaSearch, FaTimes, FaSync } from "react-icons/fa";
import { IoIosPrint } from "react-icons/io";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

const Tooltip = ({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setCoords({ x: r.left + r.width / 2, y: r.top - 10 });
    setVisible(true);
  };

  return (
    <div
      ref={ref}
      className="inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible &&
        createPortal(
          <div
            className="fixed z-[99999] pointer-events-none"
            style={{
              left: coords.x,
              top: coords.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg">
              {text}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

interface Customer {
  _id: string;
  fullName: string;
  customerId?: string;
  openingDues?: number;
}

interface PaymentMode {
  _id: string;
  name: string;
}

export interface Payment {
  _id: string;
  paymentId?: string;
  createdAt: string;
  customer: Customer;
  referenceInvoice?: string;
  paidAmount: number;
  lessAmount: number;
  cashBack: number;
  dueBeforePayment?: number;
  remainingDue?: number;
  paymentMode?: PaymentMode;
  remarks?: string;
  date?: string;
}

interface Props {
  payments: Payment[];
  fetchPayments: () => void;
  searchTerm: string;
  setSearchTerm: (t: string) => void;
}

const CustomerPaymentReceiveTable = ({
  payments,
  fetchPayments,
  searchTerm,
  setSearchTerm,
}: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const filtered = payments.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.customer?.fullName?.toLowerCase().includes(q) ||
      p.paymentId?.toLowerCase().includes(q) ||
      p._id?.toLowerCase().includes(q) ||
      p.paymentMode?.name?.toLowerCase().includes(q)
    );
  });

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 10,
  });

  // Header and rows are separate grids; a plain "1fr" track grows to fit its
  // content, so one long value widened that row's column and the headings slid
  // sideways while scrolling. minmax(0, …) plus min-w-0 on each cell keeps
  // every grid on the same widths; long values are cut instead.
  // Payment ID | Customer | Date | Created At | Due Amount | Paid | Less | Cashback | Remain | Account | Actions
  const gridTemplateColumns =
    "minmax(0,1fr) minmax(0,1.4fr) minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr) minmax(0,0.8fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,1fr) 150px";

  const handleDeleteModal = (id: string) => {
    setSelectedId(id);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    // Closing mid-request would hide a delete that is still running
    if (isDeleting) return;
    setShowDeleteModal(false);
    setSelectedId(null);
  };

  const handleDelete = async () => {
    const id = selectedId;
    // Guard against a second click while the first request is still running.
    if (!id || isDeleting) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(
        `/customer/delete-customer-payment-recived/${id}`,
      );
      toast.success("Payment deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      fetchPayments();
      setShowDeleteModal(false);
      setSelectedId(null);
    } catch (error) {
      // The modal stays open on failure, so the row is still there to retry.
      showApiError(error, "Failed to delete payment. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    fetchPayments();
  };

  const headers = [
    "Serial ID",
    "Customer Name",
    "Date",
    "Created At",
    "Due Amount (৳)",
    "Paid (৳)",
    "Less (৳)",
    "Cashback (৳)",
    "Remain (৳)",
    "Account",
    "Actions",
  ];

  return (
    <div className="w-full space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Tooltip text="Go Back">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-accent-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
            >
              <svg
                className="size-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </Button>
          </Tooltip>

          <div className="relative w-full md:w-80 group">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-accent-500 transition-colors size-4" />
            <input
              type="text"
              placeholder="Search by serial, customer, payment ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-12 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all text-sm font-medium h-12"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
              >
                <FaTimes className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
            {filtered.length} of {payments.length} records
          </span>
          <Tooltip text="Refresh Data">
            <Button
              onClick={handleRefresh}
              size="sm"
              variant="outline"
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-accent-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
            >
              <FaSync className="size-4" />
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Table */}
      {isMobile ? (
        <MobileCardList
          items={filtered}
          getKey={(payment) => payment._id}
          emptyMessage={
            searchTerm ? `No payments match "${searchTerm}"` : "No payments yet"
          }
          renderCard={(payment, index) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">
                    {payment.customer?.fullName || "—"}
                  </p>
                  <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400 inline-block mt-1">
                    {payment.paymentId || `#${index + 1}`}
                  </span>
                </div>
              </div>
              <MobileCardRow label="Date">
                <span className="block">
                  {payment.date
                    ? moment(payment.date).format("DD MMM YYYY")
                    : moment(payment.createdAt).format("DD MMM YYYY")}
                </span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  {payment.date
                    ? moment(payment.date).format("hh:mm:ss A")
                    : moment(payment.createdAt).format("hh:mm:ss A")}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Created At">
                <span className="block">
                  {moment(payment.createdAt).format("DD MMM YYYY")}
                </span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  {moment(payment.createdAt).format("hh:mm:ss A")}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Due Amount">
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  {(payment.dueBeforePayment ?? 0).toLocaleString()}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Paid">
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {payment.paidAmount?.toLocaleString() ?? "N/A"}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Less">{payment.lessAmount ?? 0}</MobileCardRow>
              <MobileCardRow label="Cashback">{payment.cashBack ?? 0}</MobileCardRow>
              <MobileCardRow label="Remain">
                <span className="font-semibold text-red-500 dark:text-red-400">
                  {(payment.remainingDue ?? 0).toLocaleString()}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Account">{payment.paymentMode?.name || "N/A"}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/customer-payment-receive-invoice-print/${payment._id}`)
                  }
                  className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                  aria-label="Print payment"
                >
                  <IoIosPrint className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate(`/customer-payment-receive-edit/${payment._id}`)
                  }
                  className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25"
                  aria-label="Edit payment"
                >
                  <FaEdit className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteModal(payment._id)}
                  className="shine flex max-md:size-11 size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                  aria-label="Delete payment"
                >
                  <MdDelete className="size-5" />
                </button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/3 overflow-hidden shadow-theme-sm">
        {/* Sticky header — outside scroll container */}
        <div
          className="grid *:min-w-0 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-white/5 px-3 py-3"
          style={{ gridTemplateColumns }}
        >
          {headers.map((h) => (
            <div
              key={h}
              title={h}
              className="flex items-center justify-center text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wide"
            >
              <span className="truncate">{h}</span>
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="size-20 rounded-2xl bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center mb-5 shadow-inner">
              <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">
              {searchTerm ? "No Results Found" : "No Payments Yet"}
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
              {searchTerm
                ? `No payments match "${searchTerm}".`
                : "No customer payment records found."}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="mt-4 px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm font-semibold transition-colors"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div
            ref={parentRef}
            className="no-scrollbar overflow-y-auto overflow-x-hidden"
            style={{ maxHeight: 600 }}
          >
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const payment = filtered[virtualRow.index];
                if (!payment) return null;
                return (
                  <div
                    key={payment._id}
                    className="absolute top-0 left-0 w-full grid *:min-w-0 items-center px-3 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* Payment ID */}
                    <div className="flex items-center justify-center px-1">
                      <span className="max-w-full truncate rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400" title={payment.paymentId || undefined}>
                        {payment.paymentId || `#${virtualRow.index + 1}`}
                      </span>
                    </div>

                    {/* Customer Name */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate" title={payment.customer?.fullName || undefined}>
                        {payment.customer?.fullName || "—"}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="flex flex-col items-center justify-center px-1">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {payment.date
                          ? moment(payment.date).format("DD MMM YYYY")
                          : moment(payment.createdAt).format("DD MMM YYYY")}
                      </span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {payment.date
                          ? moment(payment.date).format("hh:mm:ss A")
                          : moment(payment.createdAt).format("hh:mm:ss A")}
                      </span>
                    </div>

                    {/* Created At */}
                    <div className="flex flex-col items-center justify-center px-1">
                      <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {moment(payment.createdAt).format("DD MMM YYYY")}
                      </span>
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        {moment(payment.createdAt).format("hh:mm:ss A")}
                      </span>
                    </div>

                    {/* Due Amount (before this payment) */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                        {(payment.dueBeforePayment ?? 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Paid */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {payment.paidAmount?.toLocaleString() ?? "—"}
                      </span>
                    </div>

                    {/* Less */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {payment.lessAmount ?? 0}
                      </span>
                    </div>

                    {/* Cashback */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {payment.cashBack ?? 0}
                      </span>
                    </div>

                    {/* Remain Amount (after this payment) */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm font-semibold text-red-500 dark:text-red-400">
                        {(payment.remainingDue ?? 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Account */}
                    <div className="flex items-center justify-center px-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate" title={payment.paymentMode?.name || undefined}>
                        {payment.paymentMode?.name || "—"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-nowrap items-center justify-center gap-1.5">
                      <Tooltip text="Print">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/customer-payment-receive-invoice-print/${payment._id}`,
                            )
                          }
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10"
                          aria-label="Print payment"
                        >
                          <IoIosPrint className="size-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Edit">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/customer-payment-receive-edit/${payment._id}`,
                            )
                          }
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-warning-50 text-warning-600 hover:bg-warning-100 hover:text-warning-700 dark:bg-warning-500/15 dark:text-warning-400 dark:hover:bg-warning-500/25"
                          aria-label="Edit payment"
                        >
                          <FaEdit className="size-4" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Delete">
                        <button
                          type="button"
                          onClick={() => handleDeleteModal(payment._id)}
                          className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                          aria-label="Delete payment"
                        >
                          <MdDelete className="size-5" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeDeleteModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            Delete Payment?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className="font-semibold text-red-500">delete</span> this
            payment record? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={closeDeleteModal}
              disabled={isDeleting}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
                className="flex-1 !bg-error-500 hover:!bg-error-600 !text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:active:scale-100"
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deleting...
                </span>
              ) : (
                "Yes, Delete"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerPaymentReceiveTable;
