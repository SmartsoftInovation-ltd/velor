import { useState, useRef, MouseEvent } from "react";
import { createPortal } from "react-dom";
import moment from "moment";
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
import { FaEdit, FaToggleOn, FaToggleOff, FaLayerGroup, FaSearch, FaTimes, FaEye } from "react-icons/fa";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";

// Portal-based Tooltip — renders into document.body to escape overflow/z-index constraints
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
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

interface Image {
  url: string;
  publicId: string;
}

interface Subcategory {
  _id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface Category {
  _id: string;
  name: string;
  image: Image;
  slug: string;
  isActive: boolean;
  subcategories: Subcategory[];
  createdAt: string;
  discount?: {
    discountName?: string;
    discountType?: string;
    discountValueByAmount?: number;
    discountValueByPercentance?: number;
  };
}

interface CategoryTableProps {
  categories: Category[] | null;
  fetchCategories: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export default function CategoryTable({
  categories,
  fetchCategories,
  searchTerm,
  setSearchTerm,
}: CategoryTableProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ slug: string; currentStatus: boolean } | null>(null);
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string; x: number; y: number } | null>(null);
  const [hoveredSubcategories, setHoveredSubcategories] = useState<{ list: Subcategory[]; x: number; y: number } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const canEdit   = usePermission("category", "edit");
  const canDelete = usePermission("category", "delete");
  const canToggle = usePermission("category", "toggle");
  const isMobile = useIsMobile();

  const tableData = categories || [];

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90,
    overscan: 10,
  });

  const handleDeleteModal = (slug: string) => {
    setSelectedCategory(slug);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedCategory(null);
  };

  const handleDelete = async () => {
    try {
      await axiosSecure.delete(`/categories/${selectedCategory}`);
      toast.success("Category deleted successfully.");
      fetchCategories();
    } catch (error) {
      toast.error("Failed to delete the category. Please try again.");
    } finally {
      setShowDeleteModal(false);
      setSelectedCategory(null);
    }
  };

  const handleToggleModal = (slug: string, currentStatus: boolean) => {
    setPendingToggle({ slug, currentStatus });
    setShowToggleModal(true);
  };

  const handleToggleStatus = async () => {
    if (!pendingToggle) return;
    try {
      const { slug, currentStatus } = pendingToggle;
      const endpoint = currentStatus ? `/categories/${slug}/deactivate` : `/categories/${slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(`Category ${!currentStatus ? "activated" : "deactivated"} successfully.`);
      fetchCategories();
    } catch (error) {
      toast.error("Failed to update status.");
    } finally {
      setShowToggleModal(false);
      setPendingToggle(null);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  const gridTemplateColumns = "80px 1.5fr 120px 1fr 1fr 150px 120px 220px";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="w-full max-w-md relative group">
          <Input 
            placeholder="Search categories..." 
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
          getKey={(category) => category._id}
          emptyMessage={`No categories found matching "${searchTerm}"`}
          renderCard={(category, index) => (
            <div className="space-y-1">
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="w-12 h-12 shrink-0 overflow-hidden rounded-xl border-2 border-white dark:border-gray-800 shadow-md bg-gray-100">
                  <img src={category.image?.url} className="w-full h-full object-cover" alt={category.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{category.name}</p>
                  <p className="text-xs text-gray-400">#{index + 1}</p>
                </div>
                <Badge
                  size="sm"
                  variant="solid"
                  color={category.isActive ? "success" : "error"}
                  className="font-black text-[10px] uppercase shrink-0"
                >
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Subcategories">
                {category.subcategories?.length > 0 ? `${category.subcategories.length} sub` : "N/A"}
              </MobileCardRow>
              <MobileCardRow label="Discount">
                {category?.discount?.discountName || "N/A"}
              </MobileCardRow>
              <MobileCardRow label="Created">
                {moment(category.createdAt).format("MMM DD, YYYY")}
              </MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/category-view/${category.slug}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="max-md:size-11 size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                  >
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                {canToggle && (
                  <Button
                    onClick={() => handleToggleModal(category.slug, category.isActive)}
                    size="sm"
                    variant="outline"
                    className={`max-md:size-11 size-10 p-0 rounded-2xl transition-all active:scale-90 border-none ${
                      category.isActive
                        ? "text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15"
                        : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                    }`}
                  >
                    {category.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                  </Button>
                )}
                {canEdit && (
                  <Link to={`/update-category/${category.slug}`}>
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
                    onClick={() => handleDeleteModal(category.slug)}
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
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Categories Found</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[380px] leading-relaxed">
              {searchTerm ? (
                <>We couldn't find any categories matching <span className="font-bold text-brand-500">"{searchTerm}"</span>. Try checking for typos or search for a different term.</>
              ) : (
                <>There are no categories yet. Once you add one, it will show up here.</>
              )}
            </p>
            {searchTerm && (
              <Button
                onClick={handleClearSearch}
                className="rounded-xl px-10 py-3 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] border-none font-semibold text-sm shadow-lg transition-all active:scale-95"
              >
                Go Back to All Categories
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
                  Category Name
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Image
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Subcategories
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Discount Info
                </TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                  Created At
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
                  const category = tableData[virtualRow.index];
                  if (!category) return null;
                  //@ts-ignore
                  function handleSubMouseEnter(e: MouseEvent<HTMLDivElement, MouseEvent>, 
                    //@ts-ignore
                    subcategories: Subcategory[]): void {
                    throw new Error("Function not implemented.");
                  }

                  return (
                    <TableRow 
                      key={category._id} 
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
                        <Tooltip text={category.name}>
                          <span className="truncate max-w-[150px]">
                            {category.name.length > 25 ? `${category.name.substring(0, 25)}...` : category.name}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <div 
                          className="w-14 h-14 overflow-hidden rounded-2xl border-2 border-white dark:border-gray-800 shadow-md bg-gray-100 cursor-zoom-in transition-transform hover:scale-110"
                          onMouseEnter={(e) => setHoveredImage({ url: category.image?.url, name: category.name, x: e.clientX + 20, y: e.clientY - 150 })}
                          onMouseMove={(e) => setHoveredImage(prev => prev ? ({ ...prev, x: e.clientX + 20, y: e.clientY - 150 }) : null)}
                          onMouseLeave={() => setHoveredImage(null)}
                        >
                          <img
                            src={category.image?.url}
                            className="w-full h-full object-cover"
                            alt={category.name}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <div 
                          className="flex flex-wrap gap-1.5 justify-center cursor-help group/subs"
                          onMouseEnter={(e) => handleSubMouseEnter(e as any, category.subcategories)}
                          onMouseLeave={() => setHoveredSubcategories(null)}
                        >
                          {category.subcategories?.length > 0 ? (
                            <>
                              {category.subcategories.slice(0, 2).map((sub) => (
                                <Badge key={sub._id} size="sm" variant="light" color="light" className="font-semibold text-[10px]">
                                  {sub.name}
                                </Badge>
                              ))}
                              {category.subcategories?.length > 2 && (
                                <Badge size="sm" color="primary" className="font-bold text-[10px] animate-pulse">
                                  +{category.subcategories.length - 2}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400 text-xs font-semibold">N/A</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-400 flex items-center justify-center text-center">
                        {category?.discount?.discountName ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-extrabold text-brand-600 dark:text-brand-400 text-[11px] uppercase tracking-tighter">{category.discount.discountName}</span>
                            <div className="bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400 px-2 py-0.5 rounded text-[10px] font-black border border-success-100 dark:border-success-500/20">
                               {category.discount.discountValueByAmount ? `${category.discount.discountValueByAmount} TK` : `${category.discount.discountValueByPercentance}%`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs font-semibold">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-400 flex items-center justify-center text-center font-bold text-[11px]">
                        {moment(category.createdAt).format("MMM DD, YYYY")}
                      </TableCell>
                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <Badge
                          size="sm"
                          variant="solid"
                          color={category.isActive ? "success" : "error"}
                          className="min-w-[75px] font-black text-[10px] uppercase shadow-md transition-all duration-300"
                        >
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center gap-2">
                        {/* View */}
                        <Tooltip text="View details">
                          <Link to={`/category-view/${category.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                            >
                              <FaEye className="size-4" />
                            </Button>
                          </Link>
                        </Tooltip>

                        {/* Toggle Status */}
                        {canToggle && <Tooltip text={category.isActive ? "Deactivate" : "Activate"}>
                          <Button
                            onClick={() => handleToggleModal(category.slug, category.isActive)}
                            size="sm"
                            variant="outline"
                            className={`size-10 p-0 rounded-2xl transition-all active:scale-90 border-none ${
                              category.isActive
                                ? "text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15"
                                : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                            }`}
                          >
                            {category.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                          </Button>
                        </Tooltip>}

                        {/* Edit */}
                        {canEdit && <Tooltip text="Edit category">
                          <Link to={`/update-category/${category.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                            >
                              <FaEdit className="size-4" />
                            </Button>
                          </Link>
                        </Tooltip>}

                        {/* Delete */}
                        {canDelete && <Tooltip text="Delete category">
                          <Button
                            onClick={() => handleDeleteModal(category.slug)}
                            size="sm"
                            className="size-10 p-0 rounded-2xl bg-red-500 hover:bg-red-600 dark:bg-red-500/80 dark:hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
                          >
                            <MdDelete className="size-5" />
                          </Button>
                        </Tooltip>}
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

      {/* Image Preview Portal */}
      {hoveredImage && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none transition-all duration-200"
          style={{ left: hoveredImage.x, top: hoveredImage.y }}
        >
          <div className="p-1 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 animate-in zoom-in-75 duration-200">
            <img
              src={hoveredImage.url}
              className="max-w-[350px] max-h-[350px] rounded-[24px] object-contain shadow-inner"
              alt="Preview"
            />
            <div className="p-3 text-center">
              <span className="text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-[3px]">{hoveredImage.name}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Subcategories Popup Portal */}
      {hoveredSubcategories && createPortal(
        <div 
          className="fixed z-[9999] pointer-events-none transition-all duration-200"
          style={{ left: hoveredSubcategories.x, top: hoveredSubcategories.y }}
        >
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 min-w-[200px] animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
              <FaLayerGroup className="text-brand-500" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">All Subcategories</span>
            </div>
            <div className="flex flex-col gap-2">
              {hoveredSubcategories.list.map((sub) => (
                <div key={sub._id} className="flex items-center gap-2 group">
                  <div className={`size-1.5 rounded-full ${sub.isActive ? "bg-green-500" : "bg-red-500"} group-hover:scale-150 transition-transform`} />
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{sub.name}</span>
                  {!sub.isActive && <span className="text-[8px] uppercase font-black text-red-500 ml-auto">Inactive</span>}
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Category?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to <span className="font-semibold text-red-500">delete</span> this category? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">
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

      {/* Toggle Status Confirmation Modal */}
      <Modal isOpen={showToggleModal} onClose={() => { setShowToggleModal(false); setPendingToggle(null); }}>
        <div className="p-8">
          <div className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
            pendingToggle?.currentStatus ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"
          }`}>
            {pendingToggle?.currentStatus
              ? <FaToggleOn className="size-8 text-red-500" />
              : <FaToggleOff className="size-8 text-green-500" />
            }
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {pendingToggle?.currentStatus ? "Deactivate Category?" : "Activate Category?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-semibold ${pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"}`}>
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            this category?
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => { setShowToggleModal(false); setPendingToggle(null); }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all ${
                pendingToggle?.currentStatus
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
              }`}
            >
              {pendingToggle?.currentStatus ? "Yes, Deactivate" : "Yes, Activate"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
