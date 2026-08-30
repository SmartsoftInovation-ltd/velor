import { useState, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import toast from "react-hot-toast";
import { Link } from "react-router";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { FaEdit, FaSearch, FaTimes, FaToggleOn, FaToggleOff, FaEye } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

// Portal-based Tooltip
const Tooltip = ({ text, children }: { text: string; children: ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top });
      setVisible(true);
    }
  };

  return (
    <div ref={ref} className="inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{ left: coords.x, top: coords.y - 8, transform: "translate(-50%, -100%)" }}
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

interface Discount {
  serial: number;
  discountValidFrom: string;
  discountValidTo: string;
  discountName: string;
  discountType: string;
  discountValueByAmount: number;
  discountValueByPercentance: number;
  discountPlan: string;
  _id: string;
  isActive: boolean;
  slug: string;
  category?: { name: string } | null;
  subCategory?: { name: string } | null;
  product?: { name: string } | null;
}

interface DiscountTableProps {
  discounts: Discount[] | null;
  fetchDiscounts: () => void;
}

const DiscountTable = ({ discounts, fetchDiscounts }: DiscountTableProps) => {
  const queryClient = useQueryClient();
  const canAdd    = usePermission("discount", "add");
  const canEdit   = usePermission("discount", "edit");
  const canDelete = usePermission("discount", "delete");
  const canToggle = usePermission("discount", "toggle");
  const [selectedDiscountSlug, setSelectedDiscountSlug] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Toggle Status State
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ slug: string; currentStatus: boolean } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Client side search filtering
  const tableData: Discount[] = Array.isArray(discounts) 
    ? discounts.filter(d => d.discountName.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  const virtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

  const handleToggleModal = (slug: string, currentStatus: boolean) => {
    setPendingToggle({ slug, currentStatus });
    setShowToggleModal(true);
  };

  const handleToggleStatus = async () => {
    if (!pendingToggle) return;
    try {
      const { slug, currentStatus } = pendingToggle;
      const endpoint = currentStatus ? `/discount/deactive?slug=${slug}` : `/discount/active?slug=${slug}`;
      await axiosSecure.post(endpoint);
      toast.success(`Discount ${!currentStatus ? "activated" : "deactivated"} successfully.`);
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      fetchDiscounts();
    } catch (error) {
      showApiError(error, "Failed to update status.");
    } finally {
      setShowToggleModal(false);
      setPendingToggle(null);
    }
  };

  const handleDeleteModal = (slug: string) => {
    setSelectedDiscountSlug(slug);
    setShowDeleteModal(true);
  };

  const closeModal = () => setShowDeleteModal(false);

  const handleDelete = async () => {
    try {
      await axiosSecure.delete(`/discount/${selectedDiscountSlug}`);
      toast.success("Discount deleted successfully.");

      // Remove the row immediately instead of waiting on the refetch round-trip.
      queryClient.setQueryData<Discount[]>(["discounts"], (old) =>
        Array.isArray(old)
          ? old.filter((d) => d.slug !== selectedDiscountSlug)
          : old,
      );
      await queryClient.invalidateQueries({ queryKey: ["discounts"] });
    } catch (error) {
      showApiError(error, "Failed to delete the discount. Please try again.");
    } finally {
      setShowDeleteModal(false);
      setSelectedDiscountSlug(null);
    }
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <div className="w-full max-w-md relative group">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search discounts by name..."
            className="w-full shadow-theme-xs h-12 pr-12 pl-11 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all placeholder:text-gray-400"
          />
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 size-4 group-focus-within:text-brand-500 transition-colors" />
          
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Clear search"
            >
              <FaTimes className="size-4" />
            </button>
          )}
        </div>
      </div>

      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(discount) => discount._id}
          emptyMessage={searchTerm ? `No discounts found matching "${searchTerm}"` : "No discounts available"}
          renderCard={(discount, index) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{discount.discountName}</p>
                  <p className="text-xs text-gray-400">#{discount?.serial || index + 1}</p>
                </div>
                <Badge size="sm" color={discount.isActive ? "success" : "error"} className="shrink-0">
                  {discount.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Plan">
                {discount.discountPlan.charAt(0).toUpperCase() + discount.discountPlan.slice(1)}
              </MobileCardRow>
              <MobileCardRow label="Applicable">
                {discount.discountPlan === "category" ? discount.category?.name || "N/A" :
                 discount.discountPlan === "subCategory" ? discount.subCategory?.name || "N/A" :
                 discount.discountPlan === "product" ? discount.product?.name || "N/A" :
                 discount.discountPlan === "flat" ? "All Products" :
                 "N/A"}
              </MobileCardRow>
              <MobileCardRow label="Value">
                {discount.discountValueByAmount > 0
                  ? `${discount.discountValueByAmount} Tk`
                  : discount.discountValueByPercentance > 0
                    ? `${discount.discountValueByPercentance}%`
                    : "-"}
              </MobileCardRow>
              <MobileCardRow label="Valid">
                {new Date(discount.discountValidFrom).toLocaleDateString()} - {new Date(discount.discountValidTo).toLocaleDateString()}
              </MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/discount-view/${discount.slug}`}>
                  <Button size="sm" variant="outline" className="max-md:size-11 size-9 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-500 hover:border-blue-400 transition-all active:scale-90">
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                {canToggle && (
                  <Button
                    onClick={() => handleToggleModal(discount.slug, discount.isActive)}
                    size="sm"
                    variant="outline"
                    className={`max-md:size-11 size-9 p-0 rounded-xl transition-all active:scale-90 border-none ${
                      discount.isActive
                        ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10"
                        : "text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                    }`}
                  >
                    {discount.isActive ? <FaToggleOn className="size-6" /> : <FaToggleOff className="size-6" />}
                  </Button>
                )}
                {canEdit && (
                  <Link to={`/update-discount/${discount.slug}`}>
                    <Button size="sm" variant="outline" className="max-md:size-11 size-9 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 hover:border-brand-400 transition-all active:scale-90">
                      <FaEdit className="size-4" />
                    </Button>
                  </Link>
                )}
                {canDelete && (
                  <Button onClick={() => handleDeleteModal(discount.slug)} size="sm" className="max-md:size-11 size-9 p-0 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-md transition-all active:scale-90">
                    <MdDelete className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        />
      ) : (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div
          ref={parentRef}
          className="no-scrollbar max-w-full overflow-auto max-h-[600px]"
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow className="uppercase">
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Sr No.</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Dis Name</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Plan</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Applicable</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Type</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">From</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">To</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Value (Tk)</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Value (%)</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Status</TableCell>
                <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">Actions</TableCell>
              </TableRow>
            </TableHeader>

            <TableBody 
              className="relative w-full divide-y divide-gray-100 dark:divide-white/[0.05]"
              style={{ height: tableData.length === 0 ? "400px" : "auto" }}
            >
              {tableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="p-0 border-none">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center bg-white dark:bg-gray-900 rounded-b-xl">
                      <div className="size-20 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                        <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {searchTerm ? "No Discounts Found" : "No Discounts Available"}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[380px] leading-relaxed">
                        {searchTerm ? (
                          <>
                            We couldn't find any discounts matching <span className="font-bold text-brand-500">"{searchTerm}"</span>.
                          </>
                        ) : (
                          "You haven't added any discounts yet. Create one to get started!"
                        )}
                      </p>
                      <div className="flex items-center gap-3">
                        {searchTerm && (
                          <Button 
                            onClick={() => setSearchTerm("")} 
                            variant="outline" 
                            className="rounded-xl px-6 py-2.5 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 font-semibold text-sm"
                          >
                            Clear Search
                          </Button>
                        )}
                        {canAdd && (
                        <Link to="/create-discount">
                          <Button className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-6 py-2.5 shadow-lg shadow-blue-500/20 active:scale-95 transition-all font-semibold text-sm border-none flex items-center gap-2">
                            Create Discount
                          </Button>
                        </Link>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <TableRow>
                      <TableCell colSpan={11} style={{ height: paddingTop }}>{null}</TableCell>
                    </TableRow>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const discount = tableData[virtualRow.index];
                    return (
                      <TableRow key={discount._id} className="dark:text-gray-400">
                        <TableCell className="px-4 py-3 text-theme-sm text-start">
                          {discount?.serial || virtualRow.index + 1}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm font-medium text-gray-800 dark:text-gray-200 text-start">
                          {discount.discountName}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          <div className="flex justify-center">
                            <Badge
                              size="sm"
                              color={
                                discount.discountPlan === "category"
                                  ? "warning"
                                  : discount.discountPlan === "flat"
                                  ? "info"
                                  : "success"
                              }
                            >
                              {discount.discountPlan.charAt(0).toUpperCase() +
                                discount.discountPlan.slice(1)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center font-medium text-gray-700 dark:text-gray-300">
                          {discount.discountPlan === "category" ? discount.category?.name || "N/A" :
                           discount.discountPlan === "subCategory" ? discount.subCategory?.name || "N/A" :
                           discount.discountPlan === "product" ? discount.product?.name || "N/A" :
                           discount.discountPlan === "flat" ? "All Products" :
                           "N/A"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          <div className="flex justify-center">
                            <Badge
                              size="sm"
                              color={discount.discountType === "tk" ? "info" : "success"}
                            >
                              {discount.discountType === "tk" ? "Tk" : "Percent"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {new Date(discount.discountValidFrom).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {new Date(discount.discountValidTo).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {discount.discountValueByAmount > 0
                            ? `${discount.discountValueByAmount} Tk`
                            : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {discount.discountValueByPercentance > 0
                            ? `${discount.discountValueByPercentance}%`
                            : "-"}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          <div className="flex justify-center">
                            <Badge
                              size="sm"
                              color={discount.isActive ? "success" : "error"}
                            >
                              {discount.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm">
                          <div className="flex items-center gap-2 justify-center">
                            {/* View Action */}
                            <Tooltip text="View Discount">
                              <Link to={`/discount-view/${discount.slug}`}>
                                <Button size="sm" variant="outline" className="size-9 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-500 hover:border-blue-400 transition-all active:scale-90">
                                  <FaEye className="size-4" />
                                </Button>
                              </Link>
                            </Tooltip>

                            {/* Status Toggle Action */}
                            {canToggle && (
                            <Tooltip text={discount.isActive ? "Deactivate" : "Activate"}>
                              <Button
                                onClick={() => handleToggleModal(discount.slug, discount.isActive)}
                                size="sm"
                                variant="outline"
                                className={`size-9 p-0 rounded-xl transition-all active:scale-90 border-none ${
                                  discount.isActive
                                    ? "text-green-500 hover:bg-green-50 dark:hover:bg-green-500/10"
                                    : "text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                                }`}
                              >
                                {discount.isActive ? <FaToggleOn className="size-6" /> : <FaToggleOff className="size-6" />}
                              </Button>
                            </Tooltip>
                            )}

                            {canEdit && (
                            <Tooltip text="Edit Discount">
                              <Link to={`/update-discount/${discount.slug}`}>
                                <Button size="sm" variant="outline" className="size-9 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 hover:border-brand-400 transition-all active:scale-90">
                                  <FaEdit className="size-4" />
                                </Button>
                              </Link>
                            </Tooltip>
                            )}

                            {canDelete && (
                            <Tooltip text="Delete Discount">
                              <Button onClick={() => handleDeleteModal(discount.slug)} size="sm" className="size-9 p-0 rounded-xl bg-red-500 text-white hover:bg-red-600 shadow-md transition-all active:scale-90">
                                <MdDelete className="size-4" />
                              </Button>
                            </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <TableRow>
                      <TableCell colSpan={11} style={{ height: paddingBottom }}>{null}</TableCell>
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeModal} className="!w-full !max-w-sm">
        <div className="p-8">
          <div className="flex items-center justify-center size-16 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 mb-5 mx-auto">
            <MdDelete className="text-3xl" />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100">Delete Discount?</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed">
            Are you sure you want to <span className="font-bold text-red-500">delete</span> this discount? This action cannot be undone.
          </p>
          <div className="flex items-center gap-3 mt-8">
            <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5">Cancel</Button>
            <Button onClick={handleDelete} className="bg-red-500 text-white hover:bg-red-600 flex-1 rounded-xl py-2.5 shadow-lg shadow-red-500/20">Yes, Delete</Button>
          </div>
        </div>
      </Modal>

      {/* Toggle Status Confirmation Modal */}
      <Modal 
        isOpen={showToggleModal} 
        onClose={() => { setShowToggleModal(false); setPendingToggle(null); }}
        className="!w-full !max-w-sm"
      >
        <div className="p-8">
          <div className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
            pendingToggle?.currentStatus ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"
          }`}>
            {pendingToggle?.currentStatus
              ? <FaToggleOn className="size-8 text-red-500" />
              : <FaToggleOff className="size-8 text-green-500" />
            }
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100">
            {pendingToggle?.currentStatus ? "Deactivate Discount?" : "Activate Discount?"}
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-bold ${pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"}`}>
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            this discount?
          </p>
          <div className="flex gap-3 mt-8">
            <Button
              onClick={() => { setShowToggleModal(false); setPendingToggle(null); }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
                className={`flex-1 rounded-xl py-2.5 font-semibold text-[#1D4ED8] transition-all shadow-lg ${
                pendingToggle?.currentStatus
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF]"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF]"
              }`}
            >
              {pendingToggle?.currentStatus ? "Yes, Deactivate" : "Yes, Activate"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DiscountTable;
