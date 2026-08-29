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
  advancePaymentRecived?: number;
}

interface PaymentMode {
  _id: string;
  name: string;
}

export interface AdvancePayment {
  _id: string;
  paymentId?: string;
  createdAt: string;
  customer: Customer;
  paymentMode?: PaymentMode;
  balance: number;
  paidAmount: number;
  advanceAmount: number;
  advanceCashBack: number;
  remarks?: string;
  date?: string;
}

interface Props {
  payments: AdvancePayment[];
  fetchPayments: () => void;
  searchTerm: string;
  setSearchTerm: (t: string) => void;
}

const CustomerAdvancePaymentTable = ({
  payments,
  fetchPayments,
  searchTerm,
  setSearchTerm,
}: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
    estimateSize: () => 72,
    overscan: 10,
  });

  // Payment ID | Customer | Date | Previous Balance | Balance | Paid | Cashback | Account | Actions
  const gridTemplateColumns = "1fr 1.3fr 0.9fr 0.9fr 0.9fr 0.9fr 0.8fr 1fr 150px";

  const handleDeleteModal = (id: string) => {
    setSelectedId(id);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedId(null);
  };

  const handleDelete = async () => {
    const id = selectedId;
    setShowDeleteModal(false);
    setSelectedId(null);
    try {
      await axiosSecure.delete(
        `/customer/delete-customer-advance-payment-recived/${id}`,
      );
      toast.success("Payment deleted successfully.");
      queryClient.invalidateQueries({
        queryKey: ["customer-advance-payments"],
      });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
      fetchPayments();
    } catch {
      toast.error("Failed to delete payment. Please try again.");
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["customer-advance-payments"] });
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    fetchPayments();
  };

  const headers = [
    "ID",
    "Customer Name",
    "Date",
    "Previous Balance (৳)",
    "Paid (৳)",
    "Cashback (৳)",
    "Balance (৳)",
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
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
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
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors size-4" />
            <input
              type="text"
              placeholder="Search by customer, payment ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-12 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm font-medium h-12"
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
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
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
            searchTerm ? `No payments match "${searchTerm}"` : "No advance payments yet"
          }
          renderCard={(payment, index) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">
                    {payment.customer?.fullName || "—"}
                  </p>
                  <span className="inline-flex items-center text-xs font-mono bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg mt-1">
                    {payment.paymentId || `CAPR-SI-${(index + 1).toString().padStart(2, "0")}`}
                  </span>
                </div>
              </div>
              <MobileCardRow label="Date">
                {moment(payment.date || payment.createdAt).format("DD MMM YYYY")}
              </MobileCardRow>
              <MobileCardRow label="Time">
                {moment(payment.createdAt).format("hh:mm:ss A")}
              </MobileCardRow>
              <MobileCardRow label="Previous Balance">
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  {((payment.balance ?? 0) - (payment.paidAmount ?? 0)).toLocaleString()}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Paid">
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {payment.paidAmount?.toLocaleString() ?? "N/A"}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Cashback">{payment.advanceCashBack ?? 0}</MobileCardRow>
              <MobileCardRow label="Balance">{(payment.balance ?? 0).toLocaleString()}</MobileCardRow>
              <MobileCardRow label="Account">{payment.paymentMode?.name || "N/A"}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <button
                  onClick={() =>
                    navigate(`/customer-advance-payment-invoice-print/${payment._id}`)
                  }
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                >
                  <IoIosPrint className="size-4" />
                </button>
                <button
                  onClick={() =>
                    navigate(`/customer-advance-payment-edit/${payment.customer._id}`)
                  }
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                >
                  <FaEdit className="size-4" />
                </button>
                <button
                  onClick={() => handleDeleteModal(payment._id)}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  <MdDelete className="size-4" />
                </button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/3 overflow-hidden shadow-theme-sm">
        {/* Sticky header — outside scroll container */}
        <div
          className="grid bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-white/5 px-3 py-3"
          style={{ gridTemplateColumns }}
        >
          {headers.map((h) => (
            <div
              key={h}
              className="flex items-center justify-center text-[11px] font-bold uppercase text-gray-500 dark:text-gray-400 tracking-wide"
            >
              {h}
            </div>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="size-20 rounded-2xl bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center mb-5 shadow-inner">
              <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-2">
              {searchTerm ? "No Results Found" : "No Advance Payments Yet"}
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs leading-relaxed">
              {searchTerm
                ? `No payments match "${searchTerm}".`
                : "No customer advance payment records found."}
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
                    className="absolute top-0 left-0 w-full grid items-center px-3 border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* Payment ID */}
                    <div className="flex items-center justify-center px-1">
                      <span className="text-xs font-mono bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg">
                        {payment.paymentId ||
                          `CAPR-SI-${(virtualRow.index + 1).toString().padStart(2, "0")}`}
                      </span>
                    </div>

                    {/* Customer Name */}
                    <div className="flex items-center justify-center px-2">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                        {payment.customer?.fullName || "—"}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="flex flex-col items-center justify-center gap-1 px-1 py-1.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold whitespace-nowrap">
                        <span className="text-indigo-400 dark:text-indigo-500 font-medium">
                          {moment(payment.date || payment.createdAt).format(
                            "ddd",
                          )}
                        </span>
                        {moment(payment.date || payment.createdAt).format(
                          "DD MMM YYYY",
                        )}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] font-medium whitespace-nowrap">
                        {moment(payment.createdAt).format("hh:mm:ss A")}
                      </span>
                    </div>

                    {/* Previous Balance (balance before this payment) */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                        {(
                          (payment.balance ?? 0) - (payment.paidAmount ?? 0)
                        ).toLocaleString()}
                      </span>
                    </div>

                    {/* Paid */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {payment.paidAmount?.toLocaleString() ?? "—"}
                      </span>
                    </div>

                    {/* Cashback */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {payment.advanceCashBack ?? 0}
                      </span>
                    </div>

                    {/* Balance (cumulative advance payment received as of this record) */}
                    <div className="flex items-center justify-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {(payment.balance ?? 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Account */}
                    <div className="flex items-center justify-center px-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {payment.paymentMode?.name || "—"}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-center gap-1.5">
                      <Tooltip text="Print">
                        <button
                          onClick={() =>
                            navigate(
                              `/customer-advance-payment-invoice-print/${payment._id}`,
                            )
                          }
                          className="size-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                        >
                          <IoIosPrint className="size-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Edit">
                        <button
                          onClick={() =>
                            navigate(
                              `/customer-advance-payment-edit/${payment.customer._id}`,
                            )
                          }
                          className="size-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                        >
                          <FaEdit className="size-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Delete">
                        <button
                          onClick={() => handleDeleteModal(payment._id)}
                          className="size-8 flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                        >
                          <MdDelete className="size-4" />
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
            advance payment record? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={closeDeleteModal}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
                className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all"
            >
              Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CustomerAdvancePaymentTable;
