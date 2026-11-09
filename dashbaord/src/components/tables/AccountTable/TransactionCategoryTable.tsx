import { useRef, useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaEdit, FaSearch, FaTimes } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import useIsMobile from "../../../hooks/useIsMobile";
import Button from "../../ui/button/Button";
import SearchableSelect from "../../form/SearchableSelect";
import { Modal } from "../../ui/modal";
import InputField from "../../form/input/InputField";
import Label from "../../form/Label";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

type AllowedType = "cash recived" | "cash payment";

const TYPE_OPTIONS: { value: AllowedType; label: string }[] = [
  { value: "cash recived", label: "Cash Received" },
  { value: "cash payment", label: "Cash Payment" },
];


interface TransactionCategory {
  _id: string;
  name: string;
  slug: string;
  allowedType: "cash recived" | "cash payment";
}

interface TransactionCategoryPage {
  categories: TransactionCategory[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

const PAGE_LIMIT = 50;

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

const TransactionCategoryTable = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TransactionCategory | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editedType, setEditedType] = useState<"cash recived" | "cash payment">("cash recived");
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = useInfiniteQuery<TransactionCategoryPage>({
    queryKey: ["transaction-categories"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axiosSecure.get(
        `/transaction-category/all-transition-category?page=${pageParam}&limit=${PAGE_LIMIT}`
      );
      return res.data.data as TransactionCategoryPage;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: "always",
  });

  const fetchCategories = () => {
    queryClient.resetQueries({ queryKey: ["transaction-categories"] });
  };

  const allCategories = data?.pages.flatMap((p) => p.categories) ?? [];

  const filtered = allCategories.filter((c) =>
    !searchTerm.trim() || c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Header and every row are separate grids, so columns must not size from
  // content: `1fr` grows to fit its widest cell, and the virtualizer swaps rows
  // in and out, which shifted headings sideways while scrolling. minmax(0, …)
  // and a fixed Actions width keep them identical; long values are truncated.
  const gridTemplateColumns = "80px minmax(0, 2fr) minmax(0, 1fr) 180px";

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;
    if (!selectedCategory) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/transaction-category/delete-transition-category/${selectedCategory.slug}`);
      toast.success(`Deleted "${selectedCategory.name}"`);
      fetchCategories();
    } catch (error) {
      showApiError(error, "Failed to delete category.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedCategory(null);
    }
  };

  const handleUpdate = async () => {
    // Guard against a second click while the first request is still running.
    if (isUpdating) return;
    if (!editedName.trim()) { toast.error("Category name cannot be empty."); return; }
    setIsUpdating(true);
    try {
      await axiosSecure.put(`/transaction-category/update-transition-category/${selectedCategory?.slug}`, {
        name: editedName.trim(),
        allowedType: editedType,
      });
      toast.success(`Updated to "${editedName.trim()}"`);
      setShowEditModal(false);
      fetchCategories();
    } catch (error) {
      showApiError(error, "Failed to update category.");
    } finally {
      setIsUpdating(false);
    }
  };

  const showSkeleton = isLoading;

  return (
    <div className="w-full space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-80 group">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 transition-colors group-focus-within:text-accent-500" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-200 bg-transparent pl-9 pr-9 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 dark:border-gray-700 dark:text-gray-200"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 transition-colors hover:text-red-500">
              <FaTimes className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/5 bg-white dark:bg-white/3 overflow-hidden shadow-theme-sm">
        {isError && (
          <div className="flex flex-col items-center justify-center py-20 text-center min-h-[300px]">
            <p className="text-red-500 font-bold text-lg mb-4">Failed to load categories!</p>
            <Button onClick={fetchCategories} className="px-6 py-2 bg-accent-500 text-white rounded-xl font-bold">Try Again</Button>
          </div>
        )}

        {showSkeleton && !isError && (
          <div>
            <div className="grid border-b border-gray-200 dark:border-white/5 bg-gray-50/95 dark:bg-gray-800/95" style={{ gridTemplateColumns }}>
              {["Serial ID", "Category Name", "Type", "Actions"].map((h) => (
                <div key={h} className="px-4 py-5 font-bold text-gray-500 text-[11px] uppercase dark:text-gray-400 text-center">{h}</div>
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid border-b border-gray-100 dark:border-white/5 animate-pulse" style={{ gridTemplateColumns }}>
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="px-4 py-5 flex items-center justify-center">
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded-lg w-3/4" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!showSkeleton && !isError && isMobile && (
          <div className="p-4">
            <MobileCardList
              items={filtered}
              getKey={(category) => category._id}
              emptyMessage="No transaction categories yet"
              renderCard={(category, index) => (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/5">
                    <span className="text-sm font-bold text-gray-800 dark:text-white">{category.name}</span>
                    <span className="text-xs font-semibold text-accent-600 dark:text-accent-400">#{index + 1}</span>
                  </div>
                  <MobileCardRow label="Type">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      category.allowedType === "cash recived"
                        ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                        : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
                    }`}>
                      {category.allowedType === "cash recived" ? "Cash Received" : "Cash Payment"}
                    </span>
                  </MobileCardRow>
                  <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/5">
                    <Button
                      onClick={() => { setSelectedCategory(category); setEditedName(category.name); setEditedType(category.allowedType); setShowEditModal(true); }}
                      size="sm"
                      variant="outline"
                      className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                      aria-label="Edit category"
                    >
                      <FaEdit className="size-4" />
                    </Button>
                    <Button
                      onClick={() => { setSelectedCategory(category); setShowDeleteModal(true); }}
                      size="sm"
                      className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                      aria-label="Delete category"
                    >
                      <MdDelete className="size-5" />
                    </Button>
                  </div>
                </div>
              )}
            />
            <div ref={sentinelRef} style={{ height: 1 }} />
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div className="size-6 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {!showSkeleton && !isError && !isMobile && (
          <div
            ref={parentRef}
            className="no-scrollbar max-w-full overflow-auto max-h-[650px] relative"
            style={{ minHeight: filtered.length === 0 ? "300px" : "auto" }}
          >
            {filtered.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
                <div className="size-16 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-4">
                  <FaSearch className="size-7 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">No Categories Found</h3>
                {searchTerm ? (
                  <Button onClick={() => setSearchTerm("")} variant="outline" className="rounded-xl px-6 py-2 text-sm font-semibold mt-4">Clear Search</Button>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No transaction categories yet.</p>
                )}
              </div>
            ) : (
              <Table className="w-full">
                <TableHeader className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/5 backdrop-blur-md">
                  <TableRow className="grid" style={{ gridTemplateColumns }}>
                    {["Serial ID", "Category Name", "Type", "Actions"].map((h) => (
                      <TableCell key={h} isHeader className="px-4 py-5 font-bold text-gray-500 text-[11px] uppercase dark:text-gray-400 flex min-w-0 items-center justify-center">
                        <span className="truncate" title={h}>{h}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const category = filtered[virtualRow.index];
                    if (!category) return null;
                    return (
                      <TableRow
                        key={category._id}
                        className="absolute top-0 left-0 w-full grid hover:bg-gray-50 dark:hover:bg-white/2 transition-colors border-b border-gray-100 dark:border-white/5"
                        style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)`, gridTemplateColumns }}
                      >
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className="font-medium text-gray-500 dark:text-gray-400">#{virtualRow.index + 1}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white max-w-full truncate" title={category.name}>{category.name}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className={`max-w-full truncate text-xs font-bold px-2.5 py-1 rounded-full ${
                            category.allowedType === "cash recived"
                              ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                              : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
                          }`}>
                            {category.allowedType === "cash recived" ? "Cash Received" : "Cash Payment"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex flex-nowrap min-w-0 items-center justify-center gap-2">
                          <Tooltip text="Edit">
                            <Button
                              onClick={() => { setSelectedCategory(category); setEditedName(category.name); setEditedType(category.allowedType); setShowEditModal(true); }}
                              size="sm"
                              variant="outline"
                              className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                              aria-label="Edit category"
                            >
                              <FaEdit className="size-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip text="Delete">
                            <Button
                              onClick={() => { setSelectedCategory(category); setShowDeleteModal(true); }}
                              size="sm"
                              className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                              aria-label="Delete category"
                            >
                              <MdDelete className="size-5" />
                            </Button>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {/* Sentinel — triggers next page fetch */}
            <div ref={sentinelRef} style={{ height: 1 }} />
            {isFetchingNextPage && (
              <div className="flex justify-center py-4">
                <div className="size-6 border-2 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Category?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
            Delete <span className="font-semibold text-red-500">"{selectedCategory?.name}"</span>? This cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={() => setShowDeleteModal(false)} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
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

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <div className="p-8 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Category</h2>
          <div className="space-y-2">
            <Label>Category Name</Label>
            <InputField value={editedName} onChange={(e) => setEditedName(e.target.value)} placeholder="Enter category name" />
          </div>
          <div className="space-y-2">
            <Label>Transaction Type</Label>
            <SearchableSelect
              options={TYPE_OPTIONS}
              value={editedType}
              onChange={(v) => setEditedType(v as AllowedType)}
              placeholder="Select type"
              searchPlaceholder="Search types..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
            <Button onClick={handleUpdate} disabled={isUpdating} className="flex-1 !bg-accent-500 hover:!bg-accent-600 !text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all disabled:active:scale-100">
              {isUpdating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating...
                </span>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TransactionCategoryTable;
