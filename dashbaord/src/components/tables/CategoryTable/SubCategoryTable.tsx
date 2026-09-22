import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";

import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import Input from "../../form/input/InputField";
import { Link } from "react-router";
import { Modal } from "../../ui/modal";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { MdDelete } from "react-icons/md";
import { FaEdit, FaToggleOn, FaToggleOff, FaSearch, FaTimes, FaEye, FaLayerGroup } from "react-icons/fa";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

interface Category {
  _id: string;
  name: string;
  isActive: boolean;
  slug: string;
}

interface SubCategory {
  discount: any;
  _id: string;
  name: string;
  category: Category;
  isActive: boolean;
  slug: string;
  __v: number;
}

interface SubCategoryTableProps {
  subcategories: SubCategory[];
  fetchSubCategories: () => void;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
}

// Portal-based Tooltip component
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setVisible(true);
    }
  };

  return (
    <div ref={ref} onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)} className="relative inline-block">
      {children}
      {visible && createPortal(
        <div
          className="fixed z-[9999] px-3 py-1.5 text-[11px] font-bold text-white bg-gray-900 dark:bg-gray-800 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in duration-200"
          style={{ left: coords.x, top: coords.y }}
        >
          {text}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900 dark:border-t-gray-800" />
        </div>,
        document.body
      )}
    </div>
  );
};

const SubCategoryTable = ({
  subcategories,
  fetchSubCategories,
  searchTerm,
  setSearchTerm,
}: SubCategoryTableProps) => {
  const canEdit   = usePermission("sub-category", "edit");
  const canDelete = usePermission("sub-category", "delete");
  const canToggle = usePermission("sub-category", "toggle");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ slug: string; currentStatus: boolean } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const tableData: SubCategory[] = subcategories ?? [];

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90,
    overscan: 10,
  });

  const handleDeleteModal = (slug: string) => {
    setSelectedSubCategory(slug);
    setShowDeleteModal(true);
  };

  const handleToggleModal = (slug: string, currentStatus: boolean) => {
    setPendingToggle({ slug, currentStatus });
    setShowToggleModal(true);
  };

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/subcategories/${selectedSubCategory}`);
      toast.success("Sub Category deleted successfully.");
      fetchSubCategories();
    } catch (error) {
      showApiError(error, "Failed to delete the subcategory.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedSubCategory(null);
    }
  };

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!pendingToggle) return;
    setIsToggling(true);
    try {
      const { slug, currentStatus } = pendingToggle;
      const endpoint = currentStatus ? `/subcategories/${slug}/deactive` : `/subcategories/${slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(`Subcategory ${!currentStatus ? "activated" : "deactivated"} successfully.`);
      fetchSubCategories();
    } catch (error) {
      showApiError(error, "Failed to update status.");
    } finally {
      setIsToggling(false);
      setShowToggleModal(false);
      setPendingToggle(null);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  const gridTemplateColumns = "80px 1.5fr 1.5fr 1fr 1fr 1fr 1fr 200px";

  return (
    <div className="w-full">
      <div className="flex items-center mb-6">
        <div className="w-full max-w-md relative group">
          <Input
            placeholder="Search subcategories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full shadow-theme-xs h-12 pr-12 pl-11 focus:ring-2 focus:ring-brand-500/20 rounded-xl transition-all"
          />
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 size-4 group-focus-within:text-brand-500 transition-colors" />

          {searchTerm && (
            <button
              onClick={handleClearSearch}
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
          getKey={(subcategory) => subcategory._id}
          emptyMessage={`No subcategories found matching "${searchTerm}"`}
          renderCard={(subcategory, index) => (
            <div className="space-y-1">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{subcategory.name}</p>
                  <p className="text-xs text-gray-400">#{index + 1}</p>
                </div>
                <Badge
                  size="sm"
                  variant="solid"
                  color={subcategory.isActive ? "success" : "error"}
                  className="font-black text-[10px] uppercase shrink-0"
                >
                  {subcategory.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Parent Category">{subcategory?.category?.name || "N/A"}</MobileCardRow>
              <MobileCardRow label="Discount">{subcategory?.discount?.discountName || "N/A"}</MobileCardRow>
              <MobileCardRow label="Value">
                {subcategory?.discount?.discountValueByAmount
                  ? `${subcategory.discount.discountValueByAmount} TK`
                  : subcategory?.discount?.discountValueByPercentance
                    ? `${subcategory.discount.discountValueByPercentance}%`
                    : "N/A"}
              </MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/subcategory-view/${subcategory.slug}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="max-md:size-11 size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-[#1D4ED8] hover:text-[#1D4ED8] hover:bg-blue-50 dark:hover:bg-[#C7DAFF]/10 transition-all active:scale-90"
                  >
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                {canToggle && (
                  <Button
                    onClick={() => handleToggleModal(subcategory.slug, subcategory.isActive)}
                    size="sm"
                    variant="outline"
                    className={`max-md:size-11 size-10 p-0 rounded-2xl transition-all active:scale-90 border-none ${subcategory.isActive
                      ? "text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15"
                      : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                      }`}
                  >
                    {subcategory.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                  </Button>
                )}
                {canEdit && (
                  <Link to={`/update-subcategory/${subcategory.slug}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="max-md:size-11 size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                    >
                      <FaEdit className="size-4" />
                    </Button>
                  </Link>
                )}
                {canDelete && (
                  <Button
                    onClick={() => handleDeleteModal(subcategory.slug)}
                    size="sm"
                    className="max-md:size-11 size-10 p-0 rounded-2xl bg-red-500 hover:bg-red-600 dark:bg-red-500/80 dark:hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
                  >
                    <MdDelete className="size-5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden shadow-theme-sm">
        {tableData.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-24 px-6">
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-full bg-brand-500/10 blur-2xl" />
              <div className="relative size-24 rounded-full bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-800/50 flex items-center justify-center ring-8 ring-gray-50 dark:ring-gray-800/40 animate-in zoom-in duration-300">
                <FaLayerGroup className="size-9 text-gray-300 dark:text-gray-600" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Subcategories Found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[380px] leading-relaxed">
              {searchTerm ? (
                <>We couldn't find any subcategories matching <span className="font-bold text-brand-500">"{searchTerm}"</span>. Try checking for typos or search for a different term.</>
              ) : (
                <>There are no subcategories yet. Once you add one, it will show up here.</>
              )}
            </p>
            {searchTerm && (
              <Button
                onClick={handleClearSearch}
                className="rounded-xl px-10 py-3 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] border-none font-semibold text-sm shadow-lg transition-all active:scale-95"
              >
                Go Back to All
              </Button>
            )}
          </div>
        ) : (
        <div
          ref={parentRef}
          className="no-scrollbar max-w-full overflow-auto max-h-[650px]"
          style={{ minHeight: "500px" }}
        >
          <Table className="w-full min-w-[1250px]">
            <TableHeader className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/[0.05] backdrop-blur-md">
              <TableRow
                className="grid"
                style={{ gridTemplateColumns }}
              >
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  S/N
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Subcategory Name
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Parent Category
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Discount Name
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Discount Type
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Value
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Status
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody
              className="relative w-full"
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const subcategory = tableData[virtualRow.index];
                  if (!subcategory) return null;

                  return (
                    <TableRow
                      key={subcategory._id}
                      className="absolute top-0 left-0 w-full grid hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors border-b border-gray-100 dark:border-white/[0.05] hover:z-20"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        gridTemplateColumns
                      }}
                    >
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-500 dark:text-gray-400 flex items-center justify-center font-medium">
                        #{virtualRow.index + 1}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm font-bold text-gray-800 dark:text-white/90 flex items-center justify-center text-center">
                        <Tooltip text={subcategory.name}>
                          <span className="truncate max-w-[150px]">
                            {subcategory.name.length > 25 ? `${subcategory.name.substring(0, 25)}...` : subcategory.name}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-400 flex items-center justify-center text-center">
                        {subcategory?.category?.name || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-400 flex items-center justify-center text-center">
                        {subcategory?.discount?.discountName || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-400 flex items-center justify-center text-center">
                        {subcategory?.discount?.discountType || "N/A"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-theme-sm flex items-center justify-center">
                        {subcategory?.discount?.discountValueByAmount
                          ? <Badge size="sm" color="success" variant="light" className="font-bold">{subcategory.discount.discountValueByAmount} TK</Badge>
                          : subcategory?.discount?.discountValueByPercentance
                            ? <Badge size="sm" color="primary" variant="light" className="font-bold">{subcategory.discount.discountValueByPercentance}%</Badge>
                            : <span className="text-gray-400 font-semibold text-xs">N/A</span>}
                      </TableCell>
                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <Badge
                          size="sm"
                          variant="solid"
                          color={subcategory.isActive ? "success" : "error"}
                          className="min-w-[75px] font-black text-[10px] uppercase shadow-md transition-all duration-300"
                        >
                          {subcategory.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 flex items-center justify-center gap-2">
                        {/* View */}
                        <Tooltip text="View Details">
                          <Link to={`/subcategory-view/${subcategory.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-[#1D4ED8] hover:text-[#1D4ED8] hover:bg-blue-50 dark:hover:bg-[#C7DAFF]/10 transition-all active:scale-90"
                            >
                              <FaEye className="size-4" />
                            </Button>
                          </Link>
                        </Tooltip>
                        {/* Toggle Status */}
                        {canToggle && (
                        <Tooltip text={subcategory.isActive ? "Deactivate" : "Activate"}>
                          <Button
                            onClick={() => handleToggleModal(subcategory.slug, subcategory.isActive)}
                            size="sm"
                            variant="outline"
                            className={`size-10 p-0 rounded-2xl transition-all active:scale-90 border-none ${subcategory.isActive
                              ? "text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15"
                              : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                              }`}
                          >
                            {subcategory.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                          </Button>
                        </Tooltip>
                        )}

                        {/* Edit */}
                        {canEdit && (
                        <Tooltip text="Edit subcategory">
                          <Link to={`/update-subcategory/${subcategory.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                            >
                              <FaEdit className="size-4" />
                            </Button>
                          </Link>
                        </Tooltip>
                        )}

                        {/* Delete */}
                        {canDelete && (
                        <Tooltip text="Delete subcategory">
                          <Button
                            onClick={() => handleDeleteModal(subcategory.slug)}
                            size="sm"
                            className="size-10 p-0 rounded-2xl bg-red-500 hover:bg-red-600 dark:bg-red-500/80 dark:hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
                          >
                            <MdDelete className="size-5" />
                          </Button>
                        </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
        )}
      </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} className="max-w-[450px]">
        <div className="bg-white dark:bg-gray-900 p-8 text-center">
          <div className="size-16 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <MdDelete className="size-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Delete Subcategory</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            Are you sure you want to delete this subcategory? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowDeleteModal(false)}
              variant="outline"
              className="flex-1 rounded-xl py-3 border-gray-200 dark:border-gray-700 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
                className="flex-1 rounded-xl py-3 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg border-none font-bold transition-transform active:scale-95 disabled:active:scale-100"
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                  Deleting...
                </span>
              ) : (
                "Confirm Delete"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Toggle Modal */}
      <Modal isOpen={showToggleModal} onClose={() => setShowToggleModal(false)} className="max-w-[450px]">
        <div className="bg-white dark:bg-gray-900 p-8 text-center">
          <div className={`size-16 rounded-full flex items-center justify-center mx-auto mb-4 ${pendingToggle?.currentStatus ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"}`}>
            {pendingToggle?.currentStatus ? <FaToggleOff className="size-8 text-red-500" /> : <FaToggleOn className="size-8 text-green-500" />}
          </div>
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
            {pendingToggle?.currentStatus ? "Deactivate" : "Activate"} Subcategory
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
            Are you sure you want to {pendingToggle?.currentStatus ? "deactivate" : "activate"} this subcategory?
            This will change its visibility in the system.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowToggleModal(false)}
              variant="outline"
              className="flex-1 rounded-xl py-3 border-gray-200 dark:border-gray-700 font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              disabled={isToggling}
                className={`flex-1 rounded-xl py-3 text-[#1D4ED8] shadow-lg border-none font-bold transition-transform active:scale-95 ${pendingToggle?.currentStatus
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF]"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF]"
                }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                  Updating...
                </span>
              ) : (
                <>Confirm {pendingToggle?.currentStatus ? "Deactivate" : "Activate"}</>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SubCategoryTable;
