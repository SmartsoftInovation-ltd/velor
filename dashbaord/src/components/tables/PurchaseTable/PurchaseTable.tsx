import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import moment from "moment";
import toast from "react-hot-toast";
import { FaEdit, FaEye, FaSearch, FaTimes, FaSync } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { IoIosPrint } from "react-icons/io";
import { usePermission } from "../../../hooks/usePermission";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import axiosSecure from "../../../hooks/useAxiosSecure";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

// ---------- Tooltip ----------
const Tooltip = ({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      {pos &&
        createPortal(
          <div
            className="fixed z-99999 pointer-events-none"
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="px-2.5 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap">
              {text}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

// ---------- Types ----------
interface SupplierRef {
  _id: string;
  supplierName?: string;
  name?: string;
  mobile?: string;
}

interface AccountRef {
  _id: string;
  name?: string;
}

interface Purchase {
  _id: string;
  serial?: string;
  invoiceNumber: string;
  date: string;
  supplierId: SupplierRef | null;
  cashType: AccountRef | null;
  allproduct: Record<string, any>[];
  subTotal: number;
  commission: number;
  shipping: number;
  payable: number;
  dueamount: number;
  paid: number;
  createdAt: string;
}

// ---------- Columns ----------
const COLS = [
  { label: "Serial", w: "flex-1" },
  { label: "Invoice", w: "flex-1" },
  { label: "Date", w: "flex-1" },
  { label: "Created At", w: "flex-1" },
  { label: "Supplier", w: "flex-1" },
  { label: "Items", w: "w-20 shrink-0" },
  { label: "Sub Total", w: "flex-1" },
  { label: "Paid", w: "flex-1" },
  { label: "Due", w: "flex-1" },
  { label: "Actions", w: "w-52 shrink-0" },
];

// ---------- Skeleton ----------
const SkeletonRow = () => (
  <div className="flex items-center px-4 py-4 border-b border-gray-100 dark:border-white/5 animate-pulse">
    {COLS.map((col, i) => (
      <div key={i} className={`${col.w} px-2`}>
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-3/4" />
      </div>
    ))}
  </div>
);

// ---------- Component ----------
const PurchaseTable = () => {
  const queryClient = useQueryClient();
  const canEdit = usePermission("purchase", "edit");
  const canDelete = usePermission("purchase", "delete");
  const [selectedPurchase, setSelectedPurchase] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const {
    data: purchaseList = [],
    isLoading,

    isError,
    refetch,
  } = useQuery<Purchase[]>({
    queryKey: ["purchases"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/purchase/all-allpurchases");
        return data.data.purchases || [];
      } catch (err: any) {
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const fetchPurchases = () => {
    queryClient.invalidateQueries({ queryKey: ["purchases"] });
    refetch();
  };

  // Client-side search on invoice number and supplier name
  const filtered = purchaseList.filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const invoice = p.invoiceNumber?.toLowerCase() || "";
    const serial = p.serial?.toLowerCase() || "";
    const supplier = p.supplierId
      ? (p.supplierId.supplierName || p.supplierId.name || "").toLowerCase()
      : "";
    return invoice.includes(q) || serial.includes(q) || supplier.includes(q);
  });

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleDeleteModal = (id: string) => {
    setSelectedPurchase(id);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedPurchase(null);
  };

  const handleDelete = async () => {
    try {
      await axiosSecure.delete(`/purchase/delete-purchase/${selectedPurchase}`);
      toast.success("Purchase deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      // A purchase delete touches most dashboard widgets — the backend
      // cascades its cache bump to every dashboard box on write, so
      // invalidate every "dashboard-*" query here too.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      fetchPurchases();
    } catch (error) {
      showApiError(error, "Failed to delete the purchase.");
    } finally {
      closeModal();
    }
  };

  const getSupplierName = (supplierId: SupplierRef | null) => {
    if (!supplierId) return "—";
    return supplierId.supplierName || supplierId.name || "—";
  };

  return (
    <div className="w-full space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-80 group">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors size-4" />
            <input
              type="text"
              placeholder="Search by invoice or supplier..."
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
          <Tooltip text="Refresh">
            <Button
              onClick={fetchPurchases}
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
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/3 overflow-hidden shadow-theme-sm">
        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-20 text-center min-h-100">
            <p className="text-red-500 font-bold text-lg mb-4">
              Failed to load purchases!
            </p>
            <Button
              onClick={fetchPurchases}
                className="px-6 py-2 bg-[#DCE8FF] text-[#1D4ED8] rounded-xl font-bold"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Skeleton — only on initial load, not background refetch */}
        {isLoading && !isError && (
          <div>
            {/* Skeleton header */}
            <div className="bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/5">
              <div className="flex items-center px-4 py-3">
                {COLS.map((col) => (
                  <div
                    key={col.label}
                    className={`${col.w} px-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide`}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        )}

        {/* Data (mobile) */}
        {!isLoading && !isError && isMobile && (
          <div className="p-4">
            <MobileCardList
              items={filtered}
              getKey={(purchase) => purchase._id}
              emptyMessage={searchTerm ? `No results for "${searchTerm}"` : "No purchase records yet. Add your first purchase."}
              renderCard={(purchase) => (
                <div className="space-y-1">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400 text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap">
                        {purchase.serial || "—"}
                      </span>
                      <p className="text-sm font-bold text-gray-800 dark:text-white truncate mt-1">{purchase.invoiceNumber}</p>
                    </div>
                    <span
                      className={`text-sm font-bold shrink-0 ${purchase.dueamount > 0 ? "text-red-500" : "text-gray-400"}`}
                    >
                      Due ৳{purchase.dueamount?.toLocaleString() || 0}
                    </span>
                  </div>
                  <MobileCardRow label="Date">
                    <span className="block">{moment(purchase.date).format("DD MMM YYYY")}</span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      {moment(purchase.date).format("hh:mm:ss A")}
                    </span>
                  </MobileCardRow>
                  <MobileCardRow label="Created At">
                    <span className="block">{moment(purchase.createdAt).format("DD MMM YYYY")}</span>
                    <span className="block text-xs text-gray-400 dark:text-gray-500">
                      {moment(purchase.createdAt).format("hh:mm:ss A")}
                    </span>
                  </MobileCardRow>
                  <MobileCardRow label="Supplier">{getSupplierName(purchase.supplierId)}</MobileCardRow>
                  <MobileCardRow label="Items">{purchase.allproduct?.length || 0}</MobileCardRow>
                  <MobileCardRow label="Sub Total">৳{purchase.subTotal?.toLocaleString() || 0}</MobileCardRow>
                  <MobileCardRow label="Paid">৳{purchase.paid?.toLocaleString() || 0}</MobileCardRow>
                  <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                    <Link to={`/purchase-view/${purchase._id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="max-md:size-11 size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90 flex items-center justify-center"
                      >
                        <FaEye className="size-4" />
                      </Button>
                    </Link>
                    <Link to={`/purchase-invoice-print/${purchase._id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="max-md:size-11 size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90 flex items-center justify-center"
                      >
                        <IoIosPrint className="size-4" />
                      </Button>
                    </Link>
                    {canEdit && (
                      <Link to={`/update-purchase/${purchase._id}`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="max-md:size-11 size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90 flex items-center justify-center"
                        >
                          <FaEdit className="size-4" />
                        </Button>
                      </Link>
                    )}
                    {canDelete && (
                      <Button
                        onClick={() => handleDeleteModal(purchase._id)}
                        size="sm"
                        className="max-md:size-11 size-10 p-0 rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
                      >
                        <MdDelete className="size-5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            />
          </div>
        )}

        {/* Data (desktop) */}
        {!isLoading && !isError && !isMobile && (
          <div>
            {/* Header — outside the scroll container so it stays fixed */}
            <div className="bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/5 backdrop-blur-md">
              <div className="flex items-center px-4 py-3">
                {COLS.map((col) => (
                  <div
                    key={col.label}
                    className={`${col.w} px-2 text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide`}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>

            <div
              ref={parentRef}
              className="no-scrollbar max-w-full overflow-y-auto overflow-x-hidden max-h-162.5 relative"
              style={{ minHeight: filtered.length === 0 ? "400px" : "auto" }}
            >
              {filtered.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
                  <div className="size-20 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-6">
                    <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                    No Purchases Found
                  </h3>
                  {searchTerm ? (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-sm">
                        No results for{" "}
                        <span className="font-bold text-brand-500">
                          "{searchTerm}"
                        </span>
                      </p>
                      <Button
                        onClick={() => setSearchTerm("")}
                        variant="outline"
                        className="rounded-xl px-8 py-2.5 text-sm font-semibold"
                      >
                        Clear Search
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                      No purchase records yet. Add your first purchase.
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className="relative w-full"
                  style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const purchase = filtered[virtualRow.index];
                    if (!purchase) return null;

                    return (
                      <div
                        key={purchase._id}
                        className="absolute top-0 left-0 w-full flex items-center px-4 py-4 hover:bg-gray-50 dark:hover:bg-white/2 transition-colors border-b border-gray-100 dark:border-white/5"
                        style={{
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <div className="flex-1 min-w-0 px-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400 text-[10px] font-mono font-bold uppercase tracking-wider whitespace-nowrap">
                            {purchase.serial || "—"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 px-2">
                          <span className="text-sm font-bold text-gray-800 dark:text-white truncate block">
                            {purchase.invoiceNumber}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 px-2">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                            {moment(purchase.date).format("DD MMM YYYY")}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 block">
                            {moment(purchase.date).format("hh:mm:ss A")}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 px-2">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block">
                            {moment(purchase.createdAt).format("DD MMM YYYY")}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 block">
                            {moment(purchase.createdAt).format("hh:mm:ss A")}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 px-2">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate block">
                            {getSupplierName(purchase.supplierId)}
                          </span>
                        </div>
                        <div className="w-20 shrink-0 px-2">
                          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                            {purchase.allproduct?.length || 0}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 px-2">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            ৳{purchase.subTotal?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 px-2">
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            ৳{purchase.paid?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 px-2">
                          <span
                            className={`text-sm font-bold ${purchase.dueamount > 0 ? "text-red-500" : "text-gray-400"}`}
                          >
                            ৳{purchase.dueamount?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div className="w-52 shrink-0 px-2 flex items-center gap-2">
                          <Tooltip text="View details">
                            <Link to={`/purchase-view/${purchase._id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                  className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90 flex items-center justify-center"
                              >
                                <FaEye className="size-4" />
                              </Button>
                            </Link>
                          </Tooltip>
                          <Tooltip text="Print invoice">
                            <Link
                              to={`/purchase-invoice-print/${purchase._id}`}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                  className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90 flex items-center justify-center"
                              >
                                <IoIosPrint className="size-4" />
                              </Button>
                            </Link>
                          </Tooltip>
                          {canEdit && (
                            <Tooltip text="Edit purchase">
                              <Link to={`/update-purchase/${purchase._id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                    className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90 flex items-center justify-center"
                                >
                                  <FaEdit className="size-4" />
                                </Button>
                              </Link>
                            </Tooltip>
                          )}
                          {canDelete && (
                            <Tooltip text="Delete purchase">
                              <Button
                                onClick={() => handleDeleteModal(purchase._id)}
                                size="sm"
                                className="size-10 p-0 rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
                              >
                                <MdDelete className="size-5" />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            Delete Purchase?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className="font-semibold text-red-500">delete</span> this
            purchase? Stock and supplier dues will be reversed automatically.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={closeModal}
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

export default PurchaseTable;
