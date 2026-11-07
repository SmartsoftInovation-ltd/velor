import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
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
import toast from "react-hot-toast";
import { Link } from "react-router";
import StatusPill from "../../common/StatusPill";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { MdDelete, MdOutlineQrCodeScanner } from "react-icons/md";
import { FaEdit, FaEye, FaToggleOn, FaToggleOff, FaUserCircle, FaSearch, FaTimes, FaBoxes } from "react-icons/fa";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import InfiniteScrollTrigger from "../../common/InfiniteScrollTrigger";
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

interface ProductImage {
  url: string;
  publicId: string;
}

interface Product {
  _id: string;
  productSerialId?: string;
  name: string;
  barCode: string;
  sku: string;
  image: ProductImage[];
  category: { name: string };
  subcategory: { name: string };
  brand: { name: string } | null;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  isActive: boolean;
  slug: string;
  variantType: "singleVariant" | "multipleVariant";
}

interface ProductTableProps {
  products: Product[];
  fetchProducts: (query?: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  // The list arrives in pages from the server
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  // A search is pending or loading
  searching?: boolean;
}

export default function ProductTable({
  products,
  fetchProducts,
  searchTerm,
  setSearchTerm,
  hasMore,
  loadingMore,
  onLoadMore,
  searching = false,
}: ProductTableProps) {
  const queryClient = useQueryClient();
  const canAdd    = usePermission("product", "add");
  const canEdit   = usePermission("product", "edit");
  const canDelete = usePermission("product", "delete");
  const canToggle = usePermission("product", "toggle");
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{ slug: string; currentStatus: boolean } | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

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

  const virtualizer = useVirtualizer({
    count: products.length,
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

  // Infinite scroll: fetch the next page once the last rendered row is within
  // a few rows of the end of what is loaded.
  const lastRenderedIndex = virtualRows[virtualRows.length - 1]?.index ?? -1;
  useEffect(() => {
    if (
      onLoadMore &&
      hasMore &&
      !loadingMore &&
      products.length > 0 &&
      lastRenderedIndex >= products.length - 5
    ) {
      onLoadMore();
    }
  }, [lastRenderedIndex, products.length, hasMore, loadingMore, onLoadMore]);

  const handleDeleteModal = (slug: string) => {
    setSelectedProduct(slug);
    setShowDeleteModal(true);
  };

  const closeModal = () => setShowDeleteModal(false);

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
      await axiosSecure.put(`/product/product-status/${slug}`, {
        isActive: !currentStatus,
      });
      toast.success(`Product ${!currentStatus ? "activated" : "deactivated"} successfully.`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      fetchProducts(searchTerm);
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
      await axiosSecure.delete(`/product/deleteproduct/${selectedProduct}`);
      toast.success("Product deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      fetchProducts(searchTerm);
    } catch (error) {
      showApiError(error, "Failed to delete the product.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedProduct(null);
    }
  };

  const renderCellValue = (product: Product, field: "purchasePrice" | "retailPrice" | "wholesalePrice") => {
    const value = product[field];
    if (product.variantType === "multipleVariant" && value === 0) {
      return "N/A";
    }
    return value !== undefined && value !== null ? value.toString() : "N/A";
  };

  return (
    <div>
      <div className="flex items-center mb-6">
        <div className="w-full max-w-md relative group">
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onBlur={handleSearchBlur}
            onKeyDown={(e) => {
              // Scanners terminate input with Enter — skip the debounce
              // in the parent and search immediately instead of waiting.
              if (e.key === "Enter") {
                e.preventDefault();
                fetchProducts(searchTerm);
              }
            }}
            autoComplete="off"
            placeholder="Scan barcode or search products by name..."
            className="w-full shadow-theme-xs h-12 pr-12 pl-11 bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.1] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-all placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={focusSearchInput}
            title="Click to resume scanning"
            aria-label="Resume scanning"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-accent-500 group-focus-within:text-accent-500 transition-colors"
          >
            <MdOutlineQrCodeScanner className="size-4" />
          </button>

          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {searching && (
              <span
                role="status"
                aria-label="Searching"
                className="size-4 animate-spin rounded-full border-2 border-accent-500/25 border-t-accent-500"
              />
            )}
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="p-1 text-gray-400 transition-colors hover:text-red-500"
                title="Clear search"
                aria-label="Clear search"
              >
                <FaTimes className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* While a new search loads, the current rows stay in place and dim,
          so nothing jumps; they swap in when the results arrive */}
      <div
        aria-busy={searching}
        className={`transition-opacity duration-200 ${searching ? "pointer-events-none opacity-50" : "opacity-100"}`}
      >
      {isMobile ? (
        <MobileCardList
          items={products}
          getKey={(product) => product._id}
          emptyMessage={searchTerm ? `No products found matching "${searchTerm}"` : "No products available"}
          renderCard={(product, index) => (
            <div className="space-y-1">
              <div className="flex items-center gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="w-12 h-12 shrink-0 overflow-hidden rounded-xl border-2 border-white dark:border-gray-800 shadow-md bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  {product.variantType !== "multipleVariant" && product.image?.length > 0 ? (
                    <img src={product.image[0].url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <FaBoxes className="size-5 text-gray-400 opacity-50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 dark:text-white/90 truncate">{product.name}</p>
                  <p className="text-xs font-semibold text-accent-600 dark:text-accent-400">{product.productSerialId || `#${index + 1}`}</p>
                  <p className="text-xs text-gray-400 truncate">{product.category?.name || "N/A"}</p>
                </div>
                <div className="shrink-0">
                  <StatusPill isActive={product.isActive} />
                </div>
              </div>
              <MobileCardRow label="SKU">{product.variantType === "multipleVariant" ? "N/A" : (product.sku || "N/A")}</MobileCardRow>
              <MobileCardRow label="Brand">{product.brand?.name || "N/A"}</MobileCardRow>
              <MobileCardRow label="Retail Price">{renderCellValue(product, "retailPrice")}</MobileCardRow>
              <MobileCardRow label="Buy Rate">{renderCellValue(product, "purchasePrice")}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/[0.05]">
                <Link to={`/product-view/${product.slug}`}>
                  <Button size="sm" variant="outline" className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-gray-100 !text-gray-600 hover:!bg-gray-200 hover:!text-gray-900 dark:!bg-white/5 dark:!text-gray-400 dark:hover:!bg-white/10"
                    aria-label="View product"
                  >
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                {canToggle && (
                  <Button
                    onClick={() => handleToggleModal(product.slug, product.isActive)}
                    size="sm"
                    variant="outline"
                    className={`max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 ${
                      product.isActive
                        ? "!bg-accent-50 !text-accent-600 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-400 dark:hover:!bg-accent-500/25"
                        : "!bg-gray-100 !text-gray-400 hover:!bg-gray-200 hover:!text-gray-500 dark:!bg-white/5 dark:!text-gray-500 dark:hover:!bg-white/10"
                    }`}
                    aria-label={product.isActive ? "Deactivate product" : "Activate product"}
                  >
                    {product.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                  </Button>
                )}
                {canEdit && (
                  <Link to={`/update-product/${product.slug}`}>
                    <Button size="sm" variant="outline" className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                    aria-label="Edit product"
                  >
                      <FaEdit className="size-4" />
                    </Button>
                  </Link>
                )}
                {canDelete && (
                  <Button onClick={() => handleDeleteModal(product.slug)} size="sm" className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                    aria-label="Delete product"
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
          className="no-scrollbar max-w-full overflow-auto max-h-[600px]"
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow className="uppercase">
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Serial ID</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Barcode</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">SKU</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Images</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Product Name</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Category</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">SubCategory</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Brand</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Buy Rate</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Retail Price</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">WH Price</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Status</TableCell>
                <TableCell isHeader className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400">Actions</TableCell>
              </TableRow>
            </TableHeader>

            <TableBody 
              className="relative w-full divide-y divide-gray-100 dark:divide-white/[0.05]"
              style={{
                height: products.length === 0 ? "400px" : "auto",
              }}
            >
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="p-0 border-none">
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center bg-white dark:bg-gray-900 rounded-b-xl">
                      <div className="size-20 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
                        <FaSearch className="size-8 text-gray-300 dark:text-gray-600" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                        {searchTerm ? "No Products Found" : "No Products Available"}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-[380px] leading-relaxed">
                        {searchTerm ? (
                          <>
                            We couldn't find any products matching <span className="font-bold text-accent-500">"{searchTerm}"</span>. Try checking for typos or search for a different term.
                          </>
                        ) : (
                          "Your product inventory is currently empty. Get started by creating your first product!"
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
                        <Link to="/create-product">
                          <Button
                            className="!bg-accent-500 hover:!bg-accent-600 !text-white rounded-xl px-6 py-2.5 shadow-lg active:scale-95 transition-all font-semibold text-sm border-none flex items-center gap-2"
                          >
                            Create Product
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
                    const product = products[virtualRow.index];
                    return (
                      <TableRow key={product._id} className="dark:text-gray-400">
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          {product.productSerialId ? (
                            <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                              {product.productSerialId}
                            </span>
                          ) : (
                            <span className="font-medium text-gray-500 dark:text-gray-400">#{virtualRow.index + 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">{product.variantType === "multipleVariant" ? "N/A" : (product.barCode || "N/A")}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">{product.variantType === "multipleVariant" ? "N/A" : (product.sku || "N/A")}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm">
                          <div className="flex -space-x-2 justify-center">
                            {product.variantType === "multipleVariant" ? (
                              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-gray-400 shadow-inner" title="Variant Level Images">
                                <FaBoxes className="size-5 opacity-40" />
                              </div>
                            ) : product.image?.length > 0 ? (
                              product.image.slice(0, 3).map((img, i) => (
                                <div key={i} className="w-10 h-10 overflow-hidden border-2 border-white rounded-full dark:border-gray-900 shadow-sm">
                                  <img src={img.url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                                </div>
                              ))
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-gray-400 shadow-inner">
                                <FaUserCircle className="size-full opacity-20" />
                              </div>
                            )}
                            {product.variantType !== "multipleVariant" && product.image?.length > 3 && (
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300">+{product.image.length - 3}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm font-medium text-gray-800 dark:text-gray-200 text-center">{product.name}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">{product.category?.name || "N/A"}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">{product.subcategory?.name || "N/A"}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">{product.brand?.name || "N/A"}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">{renderCellValue(product, "purchasePrice")}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">{renderCellValue(product, "retailPrice")}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">{renderCellValue(product, "wholesalePrice")}</TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm text-center">
                          <div className="flex justify-center">
                            <StatusPill isActive={product.isActive} />
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-theme-sm">
                          <div className="flex items-center gap-2 justify-center">
                            {/* View Action */}
                            <Tooltip text="View Product">
                              <Link to={`/product-view/${product.slug}`}>
                                <Button size="sm" variant="outline" className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-gray-100 !text-gray-600 hover:!bg-gray-200 hover:!text-gray-900 dark:!bg-white/5 dark:!text-gray-400 dark:hover:!bg-white/10"
                    aria-label="View product"
                  >
                                  <FaEye className="size-4" />
                                </Button>
                              </Link>
                            </Tooltip>

                            {/* Status Toggle Action */}
                            {canToggle && (
                            <Tooltip text={product.isActive ? "Deactivate" : "Activate"}>
                              <Button
                                onClick={() => handleToggleModal(product.slug, product.isActive)}
                                size="sm"
                                variant="outline"
                                className={`size-10 p-0 !rounded border-none transition-all active:scale-90 ${
                      product.isActive
                        ? "!bg-accent-50 !text-accent-600 hover:!bg-accent-100 dark:!bg-accent-500/15 dark:!text-accent-400 dark:hover:!bg-accent-500/25"
                        : "!bg-gray-100 !text-gray-400 hover:!bg-gray-200 hover:!text-gray-500 dark:!bg-white/5 dark:!text-gray-500 dark:hover:!bg-white/10"
                    }`}
                    aria-label={product.isActive ? "Deactivate product" : "Activate product"}
                  >
                                {product.isActive ? <FaToggleOn className="size-7" /> : <FaToggleOff className="size-7" />}
                              </Button>
                            </Tooltip>
                            )}

                            {/* Edit Action */}
                            {canEdit && (
                            <Tooltip text="Edit Product">
                              <Link to={`/update-product/${product.slug}`}>
                                <Button size="sm" variant="outline" className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                    aria-label="Edit product"
                  >
                                  <FaEdit className="size-4" />
                                </Button>
                              </Link>
                            </Tooltip>
                            )}

                            {/* Delete Action */}
                            {canDelete && (
                            <Tooltip text="Delete Product">
                              <Button onClick={() => handleDeleteModal(product.slug)} size="sm" className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                    aria-label="Delete product"
                  >
                                <MdDelete className="size-5" />
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
      </div>

      {/* Desktop loads from the virtualizer above; the mobile cards grow the page */}
      <InfiniteScrollTrigger
        watch={isMobile}
        hasMore={hasMore}
        loading={loadingMore}
        onLoadMore={onLoadMore}
        label="Loading more products…"
      />
      <Modal isOpen={showDeleteModal} onClose={closeModal} className="!w-full !max-w-sm">
        <div className="p-8">
          <div className="flex items-center justify-center size-16 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 mb-5 mx-auto">
            <MdDelete className="text-3xl" />
          </div>
          <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100">Delete Product?</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed">
            Are you sure you want to <span className="font-bold text-red-500">delete</span> this product? This action cannot be undone.
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
            {pendingToggle?.currentStatus ? "Deactivate Product?" : "Activate Product?"}
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-bold ${pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"}`}>
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            this product?
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
