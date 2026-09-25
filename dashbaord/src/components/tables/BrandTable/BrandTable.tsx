import { useState, useRef } from "react";
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
import { Link } from "react-router";
import { Modal } from "../../ui/modal";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { MdDelete } from "react-icons/md";
import { FaEdit, FaToggleOn, FaToggleOff, FaSearch, FaTimes, FaEye } from "react-icons/fa";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import { showApiError } from "../../../utils/apiError";

// Simplified Tooltip without createPortal to avoid "removeChild" DOM errors
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in duration-150">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

interface Image {
  url: string;
  publicId: string;
}

interface Brand {
  _id: string;
  name: string;
  image: Image;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

interface BrandTableProps {
  brands: Brand[] | null;
  fetchBrands: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

export default function BrandTable({
  brands,
  fetchBrands,
  searchTerm,
  setSearchTerm,
}: BrandTableProps) {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ slug: string; currentStatus: boolean } | null>(null);
  const [hoveredImage, setHoveredImage] = useState<{ url: string; name: string; x: number; y: number } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const canEdit   = usePermission("brand", "edit");
  const canDelete = usePermission("brand", "delete");
  const canToggle = usePermission("brand", "toggle");
  const isMobile = useIsMobile();

  const tableData = brands || [];

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90,
    overscan: 10,
  });

  const handleDeleteModal = (slug: string) => {
    setSelectedBrand(slug);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedBrand(null);
  };

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/brand/${selectedBrand}`);
      toast.success("Brand deleted successfully.");
      fetchBrands();
    } catch (error) {
      showApiError(error, "Failed to delete the brand. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedBrand(null);
    }
  };

  const handleToggleModal = (slug: string, currentStatus: boolean) => {
    setPendingToggle({ slug, currentStatus });
    setShowToggleModal(true);
  };

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!pendingToggle) return;
    setIsToggling(true);
    try {
      const { slug, currentStatus } = pendingToggle;
      const endpoint = currentStatus ? `/brand/${slug}/deactivate` : `/brand/${slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(`Brand ${!currentStatus ? "activated" : "deactivated"} successfully.`);
      fetchBrands();
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

  const gridTemplateColumns = "80px 2fr 1fr 1.5fr 120px 220px";

  return (
    <div className="w-full space-y-6">
      {/* Brand Table Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-100 dark:border-white/[0.05] shadow-sm gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Tooltip text="Go Back">
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              size="sm"
              className="size-11 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 transition-all active:scale-90 flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Button>
          </Tooltip>

          <div className="relative w-full md:w-80 group">
            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-500 transition-colors size-4" />
            <input
              type="text"
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-12 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-sm font-medium h-12"
            />
            
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

      </div>

      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(brand) => brand._id}
          emptyMessage={`No brands found matching "${searchTerm}"`}
          renderCard={(brand, index) => (
            <div className="space-y-1">
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="w-12 h-12 shrink-0 overflow-hidden rounded-xl border-2 border-white dark:border-gray-800 shadow-md bg-gray-100">
                  <img src={brand.image?.url} className="w-full h-full object-cover" alt={brand.name} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{brand?.name || "N/A"}</p>
                  <p className="text-xs text-gray-400">#{index + 1}</p>
                </div>
                <Badge
                  size="sm"
                  variant="solid"
                  color={brand.isActive ? "success" : "error"}
                  className="font-black text-[10px] uppercase shrink-0"
                >
                  {brand.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Created</span>
                <span className="text-right text-sm text-gray-800 dark:text-white/90 font-bold">
                  {moment(brand.createdAt).format("MMM DD, YYYY")}
                </span>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/brand-view/${brand.slug}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="max-md:size-11 size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#0A6B43] hover:text-[#0A6B43] dark:hover:text-[#0A6B43] dark:bg-[#D5F0E3]/5 transition-all active:scale-90"
                  >
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                {canToggle && (
                  <Button
                    onClick={() => handleToggleModal(brand.slug, brand.isActive)}
                    size="sm"
                    variant="outline"
                    className={`max-md:size-11 size-10 p-0 rounded-2xl transition-all active:scale-90 border-none ${
                      brand.isActive
                        ? "text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15"
                        : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                    }`}
                  >
                    {brand.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                  </Button>
                )}
                {canEdit && (
                  <Link to={`/update-brand/${brand.slug}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="max-md:size-11 size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#0A6B43] hover:text-[#0A6B43] dark:hover:text-[#0A6B43] dark:bg-[#D5F0E3]/5 transition-all active:scale-90 flex items-center justify-center"
                    >
                      <FaEdit className="size-4" />
                    </Button>
                  </Link>
                )}
                {canDelete && (
                  <Button
                    onClick={() => handleDeleteModal(brand.slug)}
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
        <div
          ref={parentRef}
          className="no-scrollbar max-w-full overflow-auto max-h-[650px] relative"
          style={{ minHeight: tableData.length === 0 ? "400px" : "auto" }}
        >
          {tableData.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center z-10 bg-white dark:bg-gray-900/50">
              <div className="size-20 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">No Brands Found</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[350px] leading-relaxed">
                We couldn't find any brands matching <span className="font-bold text-brand-500">"{searchTerm}"</span>. 
              </p>
              <Button 
                onClick={handleClearSearch} 
                variant="outline" 
                className="rounded-xl px-10 py-3 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 font-semibold text-sm"
              >
                Go Back to All Brands
              </Button>
            </div>
          ) : (
            <Table className="w-full min-w-[1000px]">
              <TableHeader className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/[0.05] backdrop-blur-md">
                <TableRow 
                  className="grid" 
                  style={{ gridTemplateColumns }}
                >
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                    S/N
                  </TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                    Brand Name
                  </TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                    Logo
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
                  const brand = tableData[virtualRow.index];
                  if (!brand) return null;

                  return (
                    <TableRow 
                      key={brand._id} 
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
                        <Tooltip text={brand?.name || "No Name"}>
                          <span className="truncate max-w-[150px]">
                            {brand?.name && brand.name.length > 25 
                              ? `${brand.name.substring(0, 25)}...` 
                              : brand?.name || "N/A"}
                          </span>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <div 
                          className="w-14 h-14 overflow-hidden rounded-2xl border-2 border-white dark:border-gray-800 shadow-md bg-gray-100 cursor-zoom-in transition-transform hover:scale-110"
                          onMouseEnter={(e) => setHoveredImage({ url: brand?.image?.url, name: brand?.name || "Brand", x: e.clientX + 20, y: e.clientY - 150 })}
                          onMouseMove={(e) => setHoveredImage(prev => prev ? ({ ...prev, x: e.clientX + 20, y: e.clientY - 150 }) : null)}
                          onMouseLeave={() => setHoveredImage(null)}
                        >
                          <img
                            src={brand.image?.url}
                            className="w-full h-full object-cover"
                            alt={brand.name}
                          />
                        </div>
                      </TableCell>
                      
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-400 flex items-center justify-center text-center font-bold text-[11px]">
                        {moment(brand.createdAt).format("MMM DD, YYYY")}
                      </TableCell>
                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <Badge
                          size="sm"
                          variant="solid"
                          color={brand.isActive ? "success" : "error"}
                          className="min-w-[75px] font-black text-[10px] uppercase shadow-md transition-all duration-300"
                        >
                          {brand.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center gap-2">
                        {/* View */}
                        <Tooltip text="View details">
                          <Link to={`/brand-view/${brand.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#0A6B43] hover:text-[#0A6B43] dark:hover:text-[#0A6B43] dark:bg-[#D5F0E3]/5 transition-all active:scale-90"
                            >
                              <FaEye className="size-4" />
                            </Button>
                          </Link>
                        </Tooltip>

                        {/* Toggle Status */}
                        {canToggle && <Tooltip text={brand.isActive ? "Deactivate" : "Activate"}>
                          <Button
                            onClick={() => handleToggleModal(brand.slug, brand.isActive)}
                            size="sm"
                            variant="outline"
                            className={`size-10 p-0 rounded-2xl transition-all active:scale-90 border-none ${
                              brand.isActive
                                ? "text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15"
                                : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                            }`}
                          >
                            {brand.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                          </Button>
                        </Tooltip>}

                        {/* Edit */}
                        {canEdit && <Tooltip text="Edit brand">
                          <Link to={`/update-brand/${brand.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#0A6B43] hover:text-[#0A6B43] dark:hover:text-[#0A6B43] dark:bg-[#D5F0E3]/5 transition-all active:scale-90 flex items-center justify-center"
                            >
                              <FaEdit className="size-4" />
                            </Button>
                          </Link>
                        </Tooltip>}

                        {/* Delete */}
                        {canDelete && <Tooltip text="Delete brand">
                          <Button
                            onClick={() => handleDeleteModal(brand.slug)}
                            size="sm"
                            className="size-10 p-0 rounded-2xl bg-red-500 hover:bg-red-600 dark:bg-red-500/80 dark:hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
                          >
                            <MdDelete className="size-5" />
                          </Button>
                        </Tooltip>}
                      </TableCell>
                    </TableRow>
                  );
                })
              }
              </TableBody>
            </Table>
          )}
        </div>
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

      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Brand?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to <span className="font-semibold text-red-500">delete</span> this brand? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
                className="flex-1 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:active:scale-100"
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Deleting...
                </span>
              ) : (
                "Yes, Delete"
              )}
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
            {pendingToggle?.currentStatus ? "Deactivate Brand?" : "Activate Brand?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-semibold ${pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"}`}>
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            this brand?
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
              disabled={isToggling}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all ${
                pendingToggle?.currentStatus
 ?"bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] shadow-lg"
 :"bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] shadow-lg"
              }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Updating...
                </span>
              ) : (
                pendingToggle?.currentStatus ? "Yes, Deactivate" : "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
