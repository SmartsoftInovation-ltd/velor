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

import StatusPill from "../../common/StatusPill";
import MobileCardRow from "../../common/MobileCardRow";
import ImageWithFallback from "../../common/ImageWithFallback";
import Input from "../../form/input/InputField";
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
  brandSerialId?: string;
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

  const gridTemplateColumns = "150px 2fr 1fr 1.5fr 120px 220px";

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="w-full max-w-md relative group">
          <Input
            placeholder="Search brands..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full shadow-theme-xs h-12 pr-12 pl-11 focus:ring-2 focus:ring-accent-500/20 rounded-xl transition-all"
          />
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 size-4 group-focus-within:text-accent-500 transition-colors" />

          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Clear search"
              aria-label="Clear search"
            >
              <FaTimes className="size-4" />
            </button>
          )}
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
                  <ImageWithFallback src={brand.image?.url} alt={brand.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{brand?.name || "N/A"}</p>
                  <p className="text-xs font-semibold text-accent-600 dark:text-accent-400">{brand.brandSerialId || `#${index + 1}`}</p>
                </div>
                <div className="shrink-0">
                  <StatusPill isActive={brand.isActive} />
                </div>
              </div>
              <MobileCardRow label="Created">
                {moment(brand.createdAt).format("MMM DD, YYYY")}
              </MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/brand-view/${brand.slug}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-gray-100 !text-gray-600 hover:!bg-gray-200 hover:!text-gray-900 dark:!bg-white/5 dark:!text-gray-400 dark:hover:!bg-white/10"
                    aria-label="View brand"
                  >
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                {canToggle && (
                  <Button
                    onClick={() => handleToggleModal(brand.slug, brand.isActive)}
                    size="sm"
                    variant="outline"
                    className={`max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 ${
                      brand.isActive
                        ? "!bg-accent-50 !text-accent-600 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-400 dark:hover:!bg-accent-500/25"
                        : "!bg-gray-100 !text-gray-400 hover:!bg-gray-200 hover:!text-gray-500 dark:!bg-white/5 dark:!text-gray-500 dark:hover:!bg-white/10"
                    }`}
                    aria-label={brand.isActive ? "Deactivate brand" : "Activate brand"}
                  >
                    {brand.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                  </Button>
                )}
                {canEdit && (
                  <Link to={`/update-brand/${brand.slug}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                    aria-label="Edit brand"
                  >
                      <FaEdit className="size-4" />
                    </Button>
                  </Link>
                )}
                {canDelete && (
                  <Button
                    onClick={() => handleDeleteModal(brand.slug)}
                    size="sm"
                    className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                    aria-label="Delete brand"
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[380px] leading-relaxed">
                {searchTerm ? (
                  <>We couldn't find any brands matching <span className="font-bold text-accent-500">"{searchTerm}"</span>. Try checking for typos or search for a different term.</>
                ) : (
                  <>There are no brands yet. Once you add one, it will show up here.</>
                )}
              </p>
              {searchTerm && (
                <Button
                  onClick={handleClearSearch}
                  className="rounded-xl px-10 py-3 !bg-accent-500 hover:!bg-accent-600 !text-white border-none font-semibold text-sm shadow-lg transition-all active:scale-95"
                >
                  Go Back to All Brands
                </Button>
              )}
            </div>
          ) : (
            <Table className="w-full min-w-[1000px]">
              <TableHeader className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/[0.05] backdrop-blur-md">
                <TableRow 
                  className="grid" 
                  style={{ gridTemplateColumns }}
                >
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                    Serial ID
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
                      <TableCell className="px-4 py-3 text-theme-sm flex items-center justify-center">
                        {brand.brandSerialId ? (
                          <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                            {brand.brandSerialId}
                          </span>
                        ) : (
                          <span className="font-medium text-gray-500 dark:text-gray-400">#{virtualRow.index + 1}</span>
                        )}
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
                          <ImageWithFallback
                            src={brand.image?.url}
                            alt={brand.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </TableCell>
                      
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-600 dark:text-gray-400 flex items-center justify-center text-center font-bold text-[11px]">
                        {moment(brand.createdAt).format("MMM DD, YYYY")}
                      </TableCell>
                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <StatusPill isActive={brand.isActive} />
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center gap-2">
                        {/* View */}
                        <Tooltip text="View details">
                          <Link to={`/brand-view/${brand.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-gray-100 !text-gray-600 hover:!bg-gray-200 hover:!text-gray-900 dark:!bg-white/5 dark:!text-gray-400 dark:hover:!bg-white/10"
                    aria-label="View brand"
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
                            className={`size-10 p-0 !rounded border-none transition-all active:scale-90 ${
                      brand.isActive
                        ? "!bg-accent-50 !text-accent-600 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-400 dark:hover:!bg-accent-500/25"
                        : "!bg-gray-100 !text-gray-400 hover:!bg-gray-200 hover:!text-gray-500 dark:!bg-white/5 dark:!text-gray-500 dark:hover:!bg-white/10"
                    }`}
                    aria-label={brand.isActive ? "Deactivate brand" : "Activate brand"}
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
                                className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                    aria-label="Edit brand"
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
                            className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                    aria-label="Delete brand"
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
            <ImageWithFallback
              src={hoveredImage.url}
              alt={`${hoveredImage.name} preview`}
              className="max-w-[350px] max-h-[350px] rounded-[24px] object-contain shadow-inner"
              fallbackClassName="size-[220px] rounded-[24px]"
              iconClassName="size-20"
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
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all !bg-accent-500 hover:!bg-accent-600 !text-white shadow-lg"
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
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
