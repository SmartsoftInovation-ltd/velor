import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import { MdDelete } from "react-icons/md";
import { FaEdit, FaEye, FaSearch, FaSync, FaTimes } from "react-icons/fa";
import { IoIosPrint } from "react-icons/io";
import { usePermission } from "../../../hooks/usePermission";
import { Modal } from "../../ui/modal";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import type { Supplier } from "../../supplier/SupplierList";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
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
    <div ref={ref} className="inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{ left: coords.x, top: coords.y, transform: "translate(-50%, -100%)" }}
        >
          <div className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const truncateWords = (text: string, wordLimit: number) => {
  if (!text) return "";
  const words = text.trim().split(/\s+/);
  if (words.length <= wordLimit) return text;
  return words.slice(0, wordLimit).join(" ") + "...";
};

interface SupplierTableProps {
  suppliers: Supplier[];
  fetchSuppliers: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isFetching: boolean;
}

// Equal 1fr for all data columns; fixed only for # and Actions
const gridTemplateColumns = "110px 1fr 1fr 1fr 1fr 1fr 1fr 160px";
const COLUMNS = ["Serial ID", "Supplier Name", "Contact Person", "Designation", "Mobile", "Address", "Due Balance", "Actions"];

export default function SupplierTable({
  suppliers,
  fetchSuppliers,
  searchTerm,
  setSearchTerm,
  isFetching,
}: SupplierTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit   = usePermission("supplier", "edit");
  const canDelete = usePermission("supplier", "delete");
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: suppliers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 10,
  });

  const openDeleteModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteModal(true);
  };

  const openViewModal = (supplier: Supplier) => {
    navigate(`/supplier-view/${supplier.supplierId}`);
  };

  const handleDelete = async () => {
    if (!selectedSupplier) return;
    setIsDeleting(true);
    try {
      // Backend delete route uses supplierId (phone number) as the param
      await axiosSecure.delete(`/supplier/delete-supplier/${selectedSupplier.supplierId}`);
      toast.success("Supplier deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      fetchSuppliers();
    } catch {
      toast.error("Failed to delete supplier.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedSupplier(null);
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
            placeholder="Search by serial, name, or mobile..."
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
            onClick={fetchSuppliers}
            disabled={isFetching}
            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-brand-500 hover:border-brand-500 transition disabled:opacity-50"
          >
            <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </Tooltip>

        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {isMobile ? (
        <MobileCardList
          items={suppliers}
          getKey={(item) => item._id}
          emptyMessage="No suppliers found"
          renderCard={(item) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{item.supplierName}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-mono font-semibold mt-1">
                    {item.supplierSerialId || "—"}
                  </span>
                </div>
              </div>
              <MobileCardRow label="Contact Person">{item.contactPersonName || "N/A"}</MobileCardRow>
              <MobileCardRow label="Designation">{item.contactPersonDesignation || "N/A"}</MobileCardRow>
              <MobileCardRow label="Mobile">{item.mobile}</MobileCardRow>
              <MobileCardRow label="Due Balance">
                <span className={(item.openingDues ?? 0) > 0 ? "text-red-500 font-semibold" : "text-gray-400 dark:text-gray-500"}>
                  ৳{(item.openingDues ?? 0).toLocaleString()}
                </span>
              </MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <button
                  onClick={() => navigate(`/supplier-profile-print/${item.supplierId}`)}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                >
                  <IoIosPrint className="size-4" />
                </button>
                <button
                  onClick={() => openViewModal(item)}
                  className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  <FaEye className="size-4" />
                </button>
                {canEdit && (
                  <button
                    onClick={() => navigate(`/supplier-edit/${item.supplierId}`)}
                    className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors"
                  >
                    <FaEdit className="size-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => openDeleteModal(item)}
                    className="max-md:size-11 size-10 p-0 flex items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                  >
                    <MdDelete className="size-4" />
                  </button>
                )}
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* Header — outside scroll container */}
        <div
          className="grid bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700"
          style={{ gridTemplateColumns }}
        >
          {COLUMNS.map((col) => (
            <div
              key={col}
              className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 text-center"
            >
              {col}
            </div>
          ))}
        </div>

        {/* Scrollable body */}
        <div ref={parentRef} className="no-scrollbar overflow-y-scroll overflow-x-hidden" style={{ maxHeight: 600 }}>
          {suppliers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
              <p className="text-sm font-medium">No suppliers found</p>
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
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = suppliers[virtualRow.index];
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
                    {/* Serial ID */}
                    <div className="px-3 flex justify-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-mono font-semibold whitespace-nowrap">
                        {item.supplierSerialId || "—"}
                      </span>
                    </div>

                    {/* Supplier Name */}
                    <div className="px-3 text-sm font-medium text-gray-800 dark:text-gray-100 truncate text-center">
                      {item.supplierName}
                    </div>

                    {/* Contact Person */}
                    <div className="px-3 text-sm text-gray-600 dark:text-gray-300 truncate text-center">
                      {item.contactPersonName || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </div>

                    {/* Designation */}
                    <div className="px-3 text-sm text-gray-600 dark:text-gray-300 truncate text-center">
                      {item.contactPersonDesignation || <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </div>

                    {/* Mobile */}
                    <div className="px-3 text-sm text-gray-700 dark:text-gray-200 font-mono text-center">
                      {item.mobile}
                    </div>

                    {/* Address — 25-word truncate */}
                    <div className="px-3 text-sm text-gray-600 dark:text-gray-300 text-center">
                      {item.supplierAddress
                        ? truncateWords(item.supplierAddress, 25)
                        : <span className="text-gray-300 dark:text-gray-600">—</span>
                      }
                    </div>

                    {/* Due Balance — opening dues */}
                    <div className="px-3 text-sm font-semibold text-center">
                      <span className={(item.openingDues ?? 0) > 0 ? "text-red-500" : "text-gray-400 dark:text-gray-500"}>
                        ৳{(item.openingDues ?? 0).toLocaleString()}
                      </span>
                    </div>

                    {/* Actions: View → Edit → Delete */}
                    <div className="px-3 flex items-center justify-center gap-1.5">
                      <Tooltip text="Print">
                        <button
                          onClick={() =>
                            navigate(`/supplier-profile-print/${item.supplierId}`)
                          }
                          className="size-8 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                        >
                          <IoIosPrint className="size-3.5" />
                        </button>
                      </Tooltip>
                      <Tooltip text="View">
                        <button
                          onClick={() => openViewModal(item)}
                          className="size-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
                        >
                          <FaEye className="size-3.5" />
                        </button>
                      </Tooltip>
                      {canEdit && (
                      <Tooltip text="Edit">
                        <button
                          onClick={() => navigate(`/supplier-edit/${item.supplierId}`)}
                          className="size-8 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors"
                        >
                          <FaEdit className="size-3.5" />
                        </button>
                      </Tooltip>
                      )}
                      {canDelete && (
                      <Tooltip text="Delete">
                        <button
                          onClick={() => openDeleteModal(item)}
                          className="size-8 flex items-center justify-center rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                        >
                          <MdDelete className="size-4" />
                        </button>
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

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => { setShowDeleteModal(false); setSelectedSupplier(null); }}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            Delete Supplier?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-red-500">
              {selectedSupplier?.supplierName}
            </span>
            ? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <button
              onClick={() => { setShowDeleteModal(false); setSelectedSupplier(null); }}
              className="flex-1 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
                className="flex-1 py-2.5 text-sm rounded-xl bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] font-semibold transition disabled:opacity-50 shadow-lg active:scale-95"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

