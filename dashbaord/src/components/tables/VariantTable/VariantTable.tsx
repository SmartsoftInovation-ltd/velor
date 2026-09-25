import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import toast from "react-hot-toast";
import { Link } from "react-router";
import Badge from "../../ui/badge/Badge";
import StatusPill from "../../common/StatusPill";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { MdDelete, MdOutlineQrCodeScanner } from "react-icons/md";
import { FaEdit, FaSearch, FaTimes, FaEye, FaToggleOn, FaToggleOff, FaUserCircle } from "react-icons/fa";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError, getApiErrorMessage } from "../../../utils/apiError";

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

interface Product {
  name: string;
}

interface VariantImage {
  url: string;
  publicId: string;
}

interface Variant {
  purchasePrice: number;
  sku: string | undefined;
  product: Product | undefined;
  name: string | undefined;
  barCode: string | undefined;
  variantName: string | undefined;
  size: string | undefined;
  color: string | undefined;
  retailPrice: number | undefined;
  wholesalePrice: number;
  _id: string;
  isActive: boolean;
  slug: string;
  thumbnail?: VariantImage;
  image?: VariantImage[];
}

const VariantTable = () => {
  const queryClient = useQueryClient();
  const canAdd    = usePermission("variant", "add");
  const canEdit   = usePermission("variant", "edit");
  const canDelete = usePermission("variant", "delete");
  const canToggle = usePermission("variant", "toggle");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedVariantSlug, setSelectedVariantSlug] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ slug: string; currentStatus: boolean } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Debounce search term to avoid excessive API calls
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 1000);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  // ── Barcode scanner focus management ────────────────────────────────────
  // A USB barcode scanner behaves like a keyboard: it only "types" into
  // whichever element currently has focus. Keep the search box focused by
  // default so scanning works without clicking into it first.
  const focusSearchInput = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    focusSearchInput();
  }, [focusSearchInput]);

  const handleSearchBlur = () => {
    window.setTimeout(() => {
      const active = document.activeElement;
      const isFormField =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        active instanceof HTMLButtonElement;
      if (!isFormField) {
        focusSearchInput();
      }
    }, 150);
  };

  const { data: rawVariants = [], isLoading, isError, error: variantsError, refetch } = useQuery<Variant[]>({
    queryKey: ["variants", debouncedSearch],
    queryFn: async () => {
      let endpoint = "/variant";
      if (debouncedSearch) {
        endpoint = `/search-variant?search=${encodeURIComponent(debouncedSearch.trim())}`;
      }
      const { data } = await axiosSecure.get(endpoint);
      return data?.data?.variants || data?.data || [];
    },
    // The list must reflect a create/update as soon as the form navigates
    // back here, so it always refetches on mount rather than serving a
    // cached page. Mutations additionally invalidate ["variants"].
    staleTime: 0,
    refetchOnMount: "always",
  });

  const virtualizer = useVirtualizer({
    count: rawVariants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 70, // Estimated row height in pixels
    overscan: 10,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const paddingTop = virtualRows.length > 0 ? virtualRows?.[0]?.start || 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows?.[virtualRows.length - 1]?.end || 0)
      : 0;

  const handleDeleteModal = (slug: string) => {
    setSelectedVariantSlug(slug);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedVariantSlug(null);
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
      // Determine active / deactive endpoints based on current status
      const endpoint = currentStatus
        ? `/variant/deactive?slug=${slug}`
        : `/variant/active?slug=${slug}`;

      await axiosSecure.post(endpoint);

      toast.success(`Variant ${!currentStatus ? "activated" : "deactivated"} successfully.`);
      
      // Invalidate all variant related caches
      queryClient.invalidateQueries({ queryKey: ["variants"] });
      refetch();
    } catch (error) {
      showApiError(error, "Failed to update status.");
    } finally {
      setIsToggling(false);
      setShowToggleModal(false);
      setPendingToggle(null);
    }
  };

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/variant/${selectedVariantSlug}`);
      toast.success("Variant deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["variants"] });
      refetch();
    } catch (error) {
      showApiError(error, "Failed to delete the variant. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedVariantSlug(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        {/* Search input */}
        <div className="w-full max-w-md relative group">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onBlur={handleSearchBlur}
            onKeyDown={(e) => {
              // Scanners terminate input with Enter — skip the 1s debounce
              // and search immediately instead of waiting.
              if (e.key === "Enter") {
                e.preventDefault();
                setDebouncedSearch(searchTerm);
              }
            }}
            autoComplete="off"
            placeholder="Scan barcode or search variants by name, SKU..."
            className="w-full shadow-theme-xs h-12 pr-12 pl-11 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={focusSearchInput}
            title="Click to resume scanning"
            aria-label="Resume barcode scanning"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-accent-500 group-focus-within:text-accent-500 transition-colors"
          >
            <MdOutlineQrCodeScanner className="size-4" />
          </button>

          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              aria-label="Clear search"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Clear search"
            >
              <FaTimes className="size-4" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="w-full animate-pulse">
          <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
            <div className="h-11 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800" />
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
                <div className="w-20 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
                <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
                <div className="size-10 bg-gray-200 dark:bg-gray-700 rounded-lg shrink-0" />
                <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="w-20 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
                <div className="w-12 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
                <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
                <div className="w-16 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
                <div className="w-16 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
                <div className="w-16 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map((j) => <div key={j} className="size-8 bg-gray-200 dark:bg-gray-700 rounded-2xl" />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : isError ? (
        <div className="text-center py-20 bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05]">
          <p className="text-red-500 font-bold mb-4">{getApiErrorMessage(variantsError, "Error fetching variants!")}</p>
          <button onClick={() => refetch()} className="shine px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-semibold shadow-lg">
            Try Again
          </button>
        </div>
      ) : isMobile ? (
        <MobileCardList
          items={rawVariants}
          getKey={(variant) => variant._id}
          emptyMessage={searchTerm ? `No variants found matching "${searchTerm}"` : "No variants available"}
          renderCard={(variant, index) => (
            <div className="space-y-1">
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="w-12 h-12 shrink-0 overflow-hidden rounded-xl border-2 border-white dark:border-gray-800 shadow-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {variant.image && variant.image.length > 0 ? (
                    <img src={variant.image[0].url} alt={variant.variantName || "Variant"} className="w-full h-full object-cover" />
                  ) : variant.thumbnail?.url ? (
                    <img src={variant.thumbnail.url} alt="Variant Thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <FaUserCircle className="size-6 text-gray-400 opacity-40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{variant.variantName || "N/A"}</p>
                  <p className="text-xs font-semibold text-accent-600 dark:text-accent-400">#{index + 1}</p>
                  <p className="text-xs text-gray-400 truncate">{variant.product?.name || "N/A"}</p>
                </div>
                <div className="shrink-0">
                  <StatusPill isActive={variant.isActive} />
                </div>
              </div>
              <MobileCardRow label="SKU">{variant.sku || "N/A"}</MobileCardRow>
              <MobileCardRow label="Size / Color">
                {(variant.size ? (Array.isArray(variant.size) ? variant.size.join(", ") : variant.size) : "-")}
                {" / "}
                {(variant.color ? (Array.isArray(variant.color) ? variant.color.join(", ") : variant.color) : "-")}
              </MobileCardRow>
              <MobileCardRow label="Retail Price">{variant.retailPrice || "N/A"}</MobileCardRow>
              <MobileCardRow label="Purchase Price">{variant.purchasePrice}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/variant-view/${variant.slug}`}>
                  <Button size="sm" variant="outline" className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-gray-100 !text-gray-600 hover:!bg-gray-200 hover:!text-gray-900 dark:!bg-white/5 dark:!text-gray-400 dark:hover:!bg-white/10"
                    aria-label="View variant"
                  >
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                {canToggle && (
                  <Button
                    onClick={() => handleToggleModal(variant.slug, variant.isActive)}
                    size="sm"
                    variant="outline"
                    className={`max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 ${
                      variant.isActive
                        ? "!bg-accent-50 !text-accent-600 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-400 dark:hover:!bg-accent-500/25"
                        : "!bg-gray-100 !text-gray-400 hover:!bg-gray-200 hover:!text-gray-500 dark:!bg-white/5 dark:!text-gray-500 dark:hover:!bg-white/10"
                    }`}
                    aria-label={variant.isActive ? "Deactivate variant" : "Activate variant"}
                  >
                    {variant.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                  </Button>
                )}
                {canEdit && (
                  <Link to={`/update-variant/${variant.slug}`}>
                    <Button size="sm" variant="outline" className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                    aria-label="Edit variant"
                  >
                      <FaEdit className="size-4" />
                    </Button>
                  </Link>
                )}
                {canDelete && (
                  <Button onClick={() => handleDeleteModal(variant.slug)} size="sm" className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                    aria-label="Delete variant"
                  >
                    <MdDelete className="size-4" />
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
            className="no-scrollbar max-w-full overflow-auto max-h-[600px]"
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow className="uppercase">
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Serial ID</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Barcode</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Product</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Images</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Variant</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">SKU</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Size</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Color</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Purchase Price</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Retail Price</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">WS Price</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Status</TableCell>
                  <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Actions</TableCell>
                </TableRow>
              </TableHeader>

              <TableBody 
                className="relative w-full divide-y divide-gray-100 dark:divide-white/[0.05]"
                style={{
                  height: rawVariants.length === 0 ? "400px" : "auto",
                }}
              >
                {rawVariants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={13} className="p-0 border-none">
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center bg-white dark:bg-gray-900 rounded-b-xl">
                        <div className="size-20 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                          <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                          {searchTerm ? "No Variants Found" : "No Variants Available"}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[380px] leading-relaxed">
                          {searchTerm ? (
                            <>
                              We couldn't find any variants matching <span className="font-bold text-accent-500">"{searchTerm}"</span>. Try checking for typos or search for a different term.
                            </>
                          ) : (
                            "Your variant inventory is currently empty. Get started by creating your first variant!"
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
                          <Link to="/create-variant">
                            <Button
                              className="!bg-accent-500 hover:!bg-accent-600 !text-white rounded-xl px-6 py-2.5 shadow-lg active:scale-95 transition-all font-semibold text-sm border-none flex items-center gap-2"
                            >
                              Create Variant
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
                        <TableCell colSpan={13} style={{ height: paddingTop }}>{null}</TableCell>
                      </TableRow>
                    )}
                    {virtualRows.map((virtualRow) => {
                      const variant = rawVariants[virtualRow.index];
                      return (
                        <TableRow key={variant._id} className="dark:text-gray-400">
                          <TableCell className="px-4 py-3 text-theme-sm text-center">
                            <span className="font-medium text-gray-500 dark:text-gray-400">#{virtualRow.index + 1}</span>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center">{variant.barCode || "N/A"}</TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center font-medium text-gray-800 dark:text-gray-200">{variant.product?.name || "N/A"}</TableCell>
                          
                          {/* Images Column */}
                          <TableCell className="px-4 py-3 text-theme-sm">
                            <div className="flex -space-x-2 justify-center">
                              {variant.image && variant.image.length > 0 ? (
                                variant.image.slice(0, 3).map((img, i) => (
                                  <div key={i} className="w-10 h-10 overflow-hidden border-2 border-white rounded-full dark:border-gray-900 shadow-sm">
                                    <img src={img.url} alt={`Variant ${i + 1}`} className="w-full h-full object-cover" />
                                  </div>
                                ))
                              ) : variant.thumbnail?.url ? (
                                <div className="w-10 h-10 overflow-hidden border-2 border-white rounded-full dark:border-gray-900 shadow-sm">
                                  <img src={variant.thumbnail.url} alt="Variant Thumbnail" className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-gray-400 shadow-inner">
                                  <FaUserCircle className="size-full opacity-20" />
                                </div>
                              )}
                              {variant.image && variant.image.length > 3 && (
                                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300">+{variant.image.length - 3}</div>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="px-4 py-3 text-theme-sm text-center font-medium text-gray-800 dark:text-gray-200">{variant.variantName || "N/A"}</TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center">{variant.sku || "N/A"}</TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center">
                            {variant.size
                              ? Array.isArray(variant.size)
                                ? variant.size.join(", ")
                                : variant.size
                              : "-"}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center">
                            <div className="flex justify-center">
                              <Badge size="sm" color="orange">
                                {variant.color
                                  ? Array.isArray(variant.color)
                                    ? variant.color.join(", ")
                                    : variant.color
                                  : "-"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center">{variant.purchasePrice}</TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center">{variant.retailPrice || "N/A"}</TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center">{variant.wholesalePrice}</TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm text-center">
                            <div className="flex justify-center">
                              <StatusPill isActive={variant.isActive} />
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-theme-sm">
                            <div className="flex items-center gap-2 justify-center">
                              {/* View Action */}
                              <Tooltip text="View Variant">
                                <Link to={`/variant-view/${variant.slug}`}>
                                  <Button size="sm" variant="outline" className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-gray-100 !text-gray-600 hover:!bg-gray-200 hover:!text-gray-900 dark:!bg-white/5 dark:!text-gray-400 dark:hover:!bg-white/10"
                    aria-label="View variant"
                  >
                                    <FaEye className="size-4" />
                                  </Button>
                                </Link>
                              </Tooltip>

                              {/* Status Toggle Action */}
                              {canToggle && (
                              <Tooltip text={variant.isActive ? "Deactivate" : "Activate"}>
                                <Button
                                  onClick={() => handleToggleModal(variant.slug, variant.isActive)}
                                  size="sm"
                                  variant="outline"
                                  className={`size-10 p-0 !rounded border-none transition-all active:scale-90 ${
                      variant.isActive
                        ? "!bg-accent-50 !text-accent-600 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-400 dark:hover:!bg-accent-500/25"
                        : "!bg-gray-100 !text-gray-400 hover:!bg-gray-200 hover:!text-gray-500 dark:!bg-white/5 dark:!text-gray-500 dark:hover:!bg-white/10"
                    }`}
                    aria-label={variant.isActive ? "Deactivate variant" : "Activate variant"}
                  >
                                  {variant.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                                </Button>
                              </Tooltip>
                              )}

                              {/* Edit Action */}
                              {canEdit && (
                              <Tooltip text="Edit Variant">
                                <Link to={`/update-variant/${variant.slug}`}>
                                  <Button size="sm" variant="outline" className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                    aria-label="Edit variant"
                  >
                                    <FaEdit className="size-4" />
                                  </Button>
                                </Link>
                              </Tooltip>
                              )}

                              {/* Delete Action */}
                              {canDelete && (
                              <Tooltip text="Delete Variant">
                                <Button onClick={() => handleDeleteModal(variant.slug)} size="sm" className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                    aria-label="Delete variant"
                  >
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
                        <TableCell colSpan={13} style={{ height: paddingBottom }}>{null}</TableCell>
                      </TableRow>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeModal} className="!w-full !max-w-sm">
        <div className="p-8">
          <div className="flex items-center justify-center size-16 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 mb-5 mx-auto">
            <MdDelete className="text-3xl" />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100">Delete Variant?</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed">
            Are you sure you want to <span className="font-bold text-red-500">delete</span> this variant? This action cannot be undone.
          </p>
          <div className="flex items-center gap-3 mt-8">
            <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5">Cancel</Button>
            <Button onClick={handleDelete} disabled={isDeleting} className="flex-1 !bg-error-500 hover:!bg-error-600 !text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:active:scale-100">
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
            {pendingToggle?.currentStatus ? "Deactivate Variant?" : "Activate Variant?"}
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-bold ${pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"}`}>
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            this variant?
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
              disabled={isToggling}
                className="flex-1 rounded-xl py-2.5 font-semibold transition-all shadow-lg !bg-accent-500 hover:!bg-accent-600 !text-white shadow-lg"
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
};

export default VariantTable;
