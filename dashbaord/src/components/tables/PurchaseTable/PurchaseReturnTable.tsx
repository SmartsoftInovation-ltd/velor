import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaEdit, FaSync, FaSearch, FaTimes } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { IoIosPrint } from "react-icons/io";
import { Link } from "react-router";
import toast from "react-hot-toast";
import moment from "moment";
import axiosSecure from "../../../hooks/useAxiosSecure";

import { Modal } from "../../ui/modal";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

// ---------- Types ----------
interface ReturnProduct {
  product?: { _id: string; name: string; barCode?: string } | null;
  variant?: { _id: string; variantName: string; barCode?: string; size?: string; color?: string } | null;
  quantity: number;
  purchasePrice: number;
  subtotal: number;
}

interface PurchaseReturn {
  _id: string;
  serial?: string;
  supplier?: { supplierName: string; supplierId?: string } | null;
  returnDate: string;
  totalReturnAmount: number;
  remarks: string;
  products: ReturnProduct[];
  createdAt: string;
}

const PurchaseReturnTable = () => {
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const isMobile = useIsMobile();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 500);
  };

  const { data, isLoading, isFetching, isError } = useQuery<PurchaseReturn[]>({
    queryKey: ["purchase-returns-v2", debouncedSearch],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ limit: "200", sort: "-createdAt" });
        const term = debouncedSearch.trim();
        if (term) {
          if (/^purr-si-\d+$/i.test(term)) {
            params.set("serial", term.toUpperCase());
          } else {
            params.set("supplierName", term);
          }
        }
        const { data } = await axiosSecure.get(
          `/purchase-return?${params.toString()}`,
        );
        return data?.data?.purchaseReturns || [];
      } catch (err: any) {
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  const tableData = data || [];

  const fetchReturns = () => {
    queryClient.invalidateQueries({ queryKey: ["purchase-returns-v2"] });
  };

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 10,
  });

  const handleDeleteModal = (id: string) => {
    setSelectedId(id);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleteLoading(true);
    try {
      await axiosSecure.delete(`/purchase-return/${selectedId}`);
      toast.success("Purchase return deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      fetchReturns();
    } catch (error: any) {
      showApiError(error, "Failed to delete purchase return.");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
      setSelectedId(null);
    }
  };

  const fmt = (n: number) => n.toLocaleString("en-BD");

  const COLS = [
    { label: "ID", w: "flex-1" },
    { label: "Supplier", w: "flex-1" },
    { label: "Return Date", w: "flex-1" },
    { label: "Products", w: "flex-2" },
    { label: "Total Amount", w: "flex-1" },
    { label: "Remarks", w: "flex-1" },
    { label: "Actions", w: "w-32 shrink-0" },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 size-4 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by supplier name or serial ID (e.g. PURR-SI-01)…"
            className="w-full pl-11 pr-10 py-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setDebouncedSearch("");
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
            >
              <FaTimes className="size-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={fetchReturns}
          disabled={isFetching}
          className="size-11 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
        >
          <FaSync
            className={`size-4 ${isFetching ? "animate-spin text-brand-500" : ""}`}
          />
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-20">
          <p className="text-red-500 font-bold mb-4">
            Error fetching purchase returns!
          </p>
          <button
            onClick={() =>
              queryClient.invalidateQueries({ queryKey: ["purchase-returns-v2"] })
            }
            className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold"
          >
            Try Again
          </button>
        </div>
      ) : isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(pr) => pr._id}
          emptyMessage={debouncedSearch ? `No results for "${debouncedSearch}"` : "No purchase returns found"}
          renderCard={(pr) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2 py-1 rounded-lg whitespace-nowrap">
                    {pr.serial || "—"}
                  </span>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white truncate mt-1">
                    {pr.supplier?.supplierName ?? "—"}
                  </p>
                </div>
                <span className="text-base font-bold text-orange-600 dark:text-orange-400 tabular-nums shrink-0">
                  ৳{fmt(pr.totalReturnAmount)}
                </span>
              </div>
              <MobileCardRow label="Return Date">{moment(pr.returnDate).format("DD MMM YYYY")}</MobileCardRow>
              <MobileCardRow label="Items">{pr.products.length}</MobileCardRow>
              {pr.remarks && <MobileCardRow label="Remarks">{pr.remarks}</MobileCardRow>}
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/purchase-return-invoice-print/${pr._id}`}>
                  <button
                    type="button"
                    className="max-md:size-11 size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-all"
                  >
                    <IoIosPrint className="size-4" />
                  </button>
                </Link>
                <Link to={`/update-purchase-return/${pr._id}`}>
                  <button
                    type="button"
                    className="max-md:size-11 size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-all"
                  >
                    <FaEdit className="size-4" />
                  </button>
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeleteModal(pr._id)}
                  className="max-md:size-11 size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                >
                  <MdDelete className="size-5" />
                </button>
              </div>
            </div>
          )}
        />
      ) : (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          {/* Sticky header */}
          <div className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center px-4 py-3">
              {COLS.map((col) => (
                <div
                  key={col.label}
                  className={`${col.w} shrink-0 px-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider`}
                >
                  {col.label}
                </div>
              ))}
            </div>
          </div>

          {/* Virtualized rows */}
          {tableData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 min-h-[300px] gap-4">
              <div className="size-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <FaSearch className="size-6 text-gray-300 dark:text-gray-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  {debouncedSearch ? `No results for "${debouncedSearch}"` : "No purchase returns found"}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {debouncedSearch ? "Try a different supplier name" : "Purchase returns will appear here"}
                </p>
              </div>
              {debouncedSearch && (
                <button
                  type="button"
                  onClick={() => { setSearchTerm(""); setDebouncedSearch(""); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-500 hover:bg-brand-600 text-white transition-colors"
                >
                  <FaTimes className="size-3" />
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div ref={parentRef} className="no-scrollbar overflow-y-auto max-h-[620px]">
              <div
                style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
                className="relative"
              >
                {rowVirtualizer.getVirtualItems().map((vRow) => {
                  const pr = tableData[vRow.index];
                  return (
                    <div
                      key={pr._id}
                      data-index={vRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        transform: `translateY(${vRow.start}px)`,
                      }}
                      className="flex items-start px-4 py-4 border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/40 dark:hover:bg-gray-800/20 transition-colors"
                    >
                      {/* ID */}
                      <div className="flex-1 px-2">
                        <span className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2 py-1 rounded-lg whitespace-nowrap">
                          {pr.serial || "—"}
                        </span>
                      </div>

                      {/* Supplier */}
                      <div className="flex-1 px-2">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                          {pr.supplier?.supplierName ?? "—"}
                        </p>
                        {pr.supplier?.supplierId && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {pr.supplier.supplierId}
                          </p>
                        )}
                      </div>

                      {/* Return date */}
                      <div className="flex-1 px-2">
                        <span className="text-sm text-gray-600 dark:text-gray-300 tabular-nums">
                          {moment(pr.returnDate).format("DD MMM YYYY")}
                        </span>
                      </div>

                      {/* Products */}
                      <div className="flex-2 px-2 space-y-2.5">
                        {pr.products.map((item, i) => {
                          const name = item.product?.name ?? item.variant?.variantName ?? "—";
                          const variantName = item.variant?.variantName;
                          const barCode = item.variant?.barCode ?? item.product?.barCode;
                          const size = item.variant?.size;
                          const color = item.variant?.color;
                          return (
                            <div key={i} className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-800 dark:text-white">
                                  {name}
                                </span>
                                {variantName && (
                                  <span className="text-xs text-gray-400">[{variantName}]</span>
                                )}
                                <span className="text-xs text-gray-400 tabular-nums">×{item.quantity}</span>
                                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 tabular-nums">
                                  ৳{fmt(item.subtotal)}
                                </span>
                                <span className="text-xs text-gray-400 tabular-nums">
                                  @ ৳{fmt(item.purchasePrice)}
                                </span>
                              </div>
                              {(barCode || (size && size !== "N/A") || (color && color !== "N/A")) && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {barCode && (
                                    <span className="text-[11px] font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                      #{barCode}
                                    </span>
                                  )}
                                  {size && size !== "N/A" && (
                                    <span className="text-[11px] font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                      {size}
                                    </span>
                                  )}
                                  {color && color !== "N/A" && (
                                    <span className="text-[11px] font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded">
                                      {color}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Total */}
                      <div className="flex-1 px-2">
                        <span className="text-base font-bold text-orange-600 dark:text-orange-400 tabular-nums">
                          ৳{fmt(pr.totalReturnAmount)}
                        </span>
                      </div>

                      {/* Remarks */}
                      <div className="flex-1 px-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
                          {pr.remarks || "—"}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="w-32 shrink-0 px-2 flex items-center gap-2">
                        <Link to={`/purchase-return-invoice-print/${pr._id}`}>
                          <button
                            type="button"
                            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-all"
                          >
                            <IoIosPrint className="size-4" />
                          </button>
                        </Link>
                        <Link to={`/update-purchase-return/${pr._id}`}>
                          <button
                            type="button"
                            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-brand-400 hover:text-brand-500 transition-all"
                          >
                            <FaEdit className="size-4" />
                          </button>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteModal(pr._id)}
                          className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
                        >
                          <MdDelete className="size-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result count */}
      {tableData.length > 0 && (
        <p className="text-sm text-gray-400 dark:text-gray-500 text-right">
          {tableData.length} return{tableData.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Delete modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <div className="p-6">
          <h2 className="text-base font-bold text-gray-900 dark:text-white mb-2">
            Confirm Deletion
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Are you sure you want to delete this purchase return? This will
            restore stock and supplier dues.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
                className="px-5 py-2.5 rounded-xl text-sm font-medium bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] disabled:opacity-60 transition-colors"
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PurchaseReturnTable;
