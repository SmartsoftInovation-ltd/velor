import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MdDelete } from "react-icons/md";
import {
  FaToggleOn,
  FaToggleOff,
  FaSearch,
  FaSync,
  FaTimes,
  FaEdit,
} from "react-icons/fa";
import { IoIosPrint } from "react-icons/io";
import { Modal } from "../../ui/modal";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupplierPayment {
  _id: string;
  supplierPaymentSerialId?: string;
  transactionId: string;
  date: string;
  supplierId: string;
  paidAmount: number;
  lessAmount: number;
  remainingDue: number;
  remarks: string;
  isActive: boolean;
  createdAt?: string;
  supplier: {
    supplierName: string;
    supplierId: string;
    mobile: string;
    supplierAddress: string;
    openingDues: number;
    contactPersonName: string;
    contactPersonDesignation: string;
  };
  paymentMethod: { _id: string; name: string }[];
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

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

// ─── Grid layout ──────────────────────────────────────────────────────────────

const gridTemplateColumns = "150px 130px 130px 1fr 1fr 1fr 1fr 1fr 100px 170px";
const COLUMNS = [
  "Serial",
  "Date",
  "Created At",
  "Supplier",
  "Mobile",
  "Paid",
  "Less",
  "Account",
  "Status",
  "Actions",
];

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

// ─── Table ────────────────────────────────────────────────────────────────────

interface Props {
  payments: SupplierPayment[];
  fetchPayments: () => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  isFetching: boolean;
}

export default function SupplierPaymentTable({
  payments,
  fetchPayments,
  searchTerm,
  setSearchTerm,
  isFetching,
}: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [selectedPayment, setSelectedPayment] =
    useState<SupplierPayment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: payments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!selectedPayment) return;
    setIsActioning(true);
    try {
      await axiosSecure.delete(
        `/supplier/delete-supplier-due-payment/${selectedPayment._id}`,
      );
      toast.success("Payment deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      fetchPayments();
    } catch (error) {
      showApiError(error, "Failed to delete payment");
    } finally {
      setIsActioning(false);
      setShowDeleteModal(false);
      setSelectedPayment(null);
    }
  };

  // ── Toggle active/inactive ─────────────────────────────────────────────────

  const handleToggle = async () => {
    if (!selectedPayment) return;
    setIsActioning(true);
    const endpoint = selectedPayment.isActive
      ? `/supplier/supplier-due-payment/${selectedPayment._id}/deactivate`
      : `/supplier/supplier-due-payment/${selectedPayment._id}/activate`;
    try {
      await axiosSecure.put(endpoint);
      toast.success(
        `Payment ${selectedPayment.isActive ? "deactivated" : "activated"} successfully`,
      );
      queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      fetchPayments();
    } catch (error) {
      showApiError(error, "Failed to update status");
    } finally {
      setIsActioning(false);
      setShowToggleModal(false);
      setSelectedPayment(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by serial, supplier, or txn ID..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="size-3" />
            </button>
          )}
        </div>

        <Tooltip text="Refresh">
          <button
            onClick={fetchPayments}
            disabled={isFetching}
            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-brand-500 hover:border-brand-500 transition disabled:opacity-50"
          >
            <FaSync
              className={`size-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
          </button>
        </Tooltip>

        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {payments.length} record{payments.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {isMobile ? (
        <MobileCardList
          items={payments}
          getKey={(item) => item._id}
          emptyMessage="No payments found"
          renderCard={(item) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">
                    {item.supplier?.supplierName || item.supplierId}
                  </p>
                  <Badge size="sm" variant="light" color="primary" className="font-mono mt-1">
                    {item.supplierPaymentSerialId || "—"}
                  </Badge>
                </div>
                <Badge
                  size="sm"
                  variant="solid"
                  color={item.isActive ? "success" : "error"}
                  className="text-[10px] font-bold uppercase shrink-0"
                >
                  {item.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Date">
                <span className="block">{formatDate(item.date)}</span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  {formatTime(item.date)}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Created At">
                <span className="block">{formatDate(item.createdAt)}</span>
                <span className="block text-xs text-gray-400 dark:text-gray-500">
                  {formatTime(item.createdAt)}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Mobile">{item.supplier?.mobile || "N/A"}</MobileCardRow>
              <MobileCardRow label="Paid">
                <span className="font-semibold text-green-600 dark:text-green-400">
                  ৳{item.paidAmount.toLocaleString()}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Less">
                {item.lessAmount > 0 ? `৳${item.lessAmount.toLocaleString()}` : "N/A"}
              </MobileCardRow>
              <MobileCardRow label="Account">{item.paymentMethod?.[0]?.name || "N/A"}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <button
                  onClick={() => navigate(`/supplier-payment-invoice-print/${item._id}`)}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                >
                  <IoIosPrint className="size-4" />
                </button>
                <button
                  onClick={() => navigate(`/supplier-payment-edit/${item._id}`)}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                >
                  <FaEdit className="size-4" />
                </button>
                <button
                  onClick={() => {
                    setSelectedPayment(item);
                    setShowToggleModal(true);
                  }}
                  className={`max-md:size-11 size-10 p-0 flex items-center justify-center rounded text-white transition-colors ${
                    item.isActive
                      ? "bg-green-500 hover:bg-green-600"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {item.isActive ? <FaToggleOn className="size-5" /> : <FaToggleOff className="size-5" />}
                </button>
                <button
                  onClick={() => {
                    setSelectedPayment(item);
                    setShowDeleteModal(true);
                  }}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  <MdDelete className="size-4" />
                </button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* Sticky header — outside scroll container */}
        <div
          className="grid bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700"
          style={{ gridTemplateColumns }}
        >
          {COLUMNS.map((col) => (
            <div
              key={col}
              className={`px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 ${
                col === "Serial" || col === "Status" || col === "Actions"
                  ? "text-center"
                  : "text-left"
              }`}
            >
              {col}
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div
          ref={parentRef}
          className="no-scrollbar overflow-y-scroll overflow-x-hidden"
          style={{ maxHeight: 600 }}
        >
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <p className="text-sm font-medium">No payments found</p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="mt-2 text-xs text-brand-500 hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div
              style={{
                height: rowVirtualizer.getTotalSize(),
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = payments[virtualRow.index];
                return (
                  <div
                    key={item._id}
                    className="absolute top-0 left-0 w-full grid items-center border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
                    style={{
                      gridTemplateColumns,
                      height: virtualRow.size,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {/* Serial */}
                    <div className="px-3 flex justify-center">
                      <Badge
                        size="sm"
                        variant="light"
                        color="primary"
                        className="font-mono"
                      >
                        {item.supplierPaymentSerialId || "—"}
                      </Badge>
                    </div>

                    {/* Date */}
                    <div className="px-3">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {formatDate(item.date)}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {formatTime(item.date)}
                      </p>
                    </div>

                    {/* Created At */}
                    <div className="px-3">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        {formatDate(item.createdAt)}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {formatTime(item.createdAt)}
                      </p>
                    </div>

                    {/* Supplier Name */}
                    <div className="px-3 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {item.supplier?.supplierName || item.supplierId}
                    </div>

                    {/* Mobile */}
                    <div className="px-3 text-sm font-mono text-gray-600 dark:text-gray-300">
                      {item.supplier?.mobile || "—"}
                    </div>

                    {/* Paid */}
                    <div className="px-3 text-sm font-semibold text-green-600 dark:text-green-400">
                      ৳{item.paidAmount.toLocaleString()}
                    </div>

                    {/* Less */}
                    <div className="px-3 text-sm text-gray-500 dark:text-gray-400">
                      {item.lessAmount > 0 ? (
                        `৳${item.lessAmount.toLocaleString()}`
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">
                          —
                        </span>
                      )}
                    </div>

                    {/* Account */}
                    <div className="px-3 text-sm text-gray-600 dark:text-gray-300 truncate">
                      {item.paymentMethod?.[0]?.name || "—"}
                    </div>

                    {/* Status badge */}
                    <div className="px-3 flex justify-center">
                      <Badge
                        size="sm"
                        variant="solid"
                        color={item.isActive ? "success" : "error"}
                        className="text-[10px] font-bold uppercase"
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    {/* Actions: Print + Edit + Toggle + Delete */}
                    <div className="px-3 flex items-center justify-center gap-1.5">
                      <Tooltip text="Print">
                        <button
                          onClick={() =>
                            navigate(`/supplier-payment-invoice-print/${item._id}`)
                          }
                          className="size-8 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                        >
                          <IoIosPrint className="size-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip text="Edit">
                        <button
                          onClick={() =>
                            navigate(`/supplier-payment-edit/${item._id}`)
                          }
                          className="size-8 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-gray-500 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                        >
                          <FaEdit className="size-3.5" />
                        </button>
                      </Tooltip>

                      <Tooltip text={item.isActive ? "Deactivate" : "Activate"}>
                        <button
                          onClick={() => {
                            setSelectedPayment(item);
                            setShowToggleModal(true);
                          }}
                          className={`size-8 flex items-center justify-center rounded text-white transition-colors ${
                            item.isActive
                              ? "bg-green-500 hover:bg-green-600"
                              : "bg-red-500 hover:bg-red-600"
                          }`}
                        >
                          {item.isActive ? (
                            <FaToggleOn className="size-4" />
                          ) : (
                            <FaToggleOff className="size-4" />
                          )}
                        </button>
                      </Tooltip>

                      <Tooltip text="Delete">
                        <button
                          onClick={() => {
                            setSelectedPayment(item);
                            setShowDeleteModal(true);
                          }}
                          className="size-8 flex items-center justify-center rounded bg-white border border-gray-200 dark:border-gray-700 dark:bg-gray-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <MdDelete className="size-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Toggle Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={showToggleModal}
        onClose={() => {
          setShowToggleModal(false);
          setSelectedPayment(null);
        }}
      >
        <div className="p-8">
          <div
            className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
              selectedPayment?.isActive
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-green-50 dark:bg-green-500/10"
            }`}
          >
            {selectedPayment?.isActive ? (
              <FaToggleOn className="size-8 text-red-500" />
            ) : (
              <FaToggleOff className="size-8 text-green-500" />
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {selectedPayment?.isActive
              ? "Deactivate Payment?"
              : "Activate Payment?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span
              className={`font-semibold ${selectedPayment?.isActive ? "text-red-500" : "text-green-500"}`}
            >
              {selectedPayment?.isActive ? "deactivate" : "activate"}
            </span>{" "}
            transaction{" "}
            <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
              {selectedPayment?.transactionId}
            </span>
            ?
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => {
                setShowToggleModal(false);
                setSelectedPayment(null);
              }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggle}
              disabled={isActioning}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all disabled:opacity-50 ${
                selectedPayment?.isActive
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
              }`}
            >
              {isActioning
                ? "Updating..."
                : selectedPayment?.isActive
                  ? "Yes, Deactivate"
                  : "Yes, Activate"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ──────────────────────────────────────────────────── */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedPayment(null);
        }}
      >
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white text-center">
            Delete Payment?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
            Permanently delete transaction{" "}
            <span className="font-mono font-semibold text-red-500">
              {selectedPayment?.transactionId}
            </span>
            ? This cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedPayment(null);
              }}
              className="flex-1 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isActioning}
                className="flex-1 py-2.5 text-sm rounded-xl bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] font-semibold transition disabled:opacity-50"
            >
              {isActioning ? "Deleting..." : "Yes, Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
