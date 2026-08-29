import { useRef, useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaEdit, FaSearch, FaTimes, FaChevronDown, FaArrowDown, FaArrowUp, FaCheck } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import useIsMobile from "../../../hooks/useIsMobile";
import Button from "../../ui/button/Button";
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

type AllowedType = "cash recived" | "cash payment";

const TYPE_OPTIONS: { value: AllowedType; label: string }[] = [
  { value: "cash recived", label: "Cash Received" },
  { value: "cash payment", label: "Cash Payment" },
];

// ---------- Styled transaction-type dropdown ----------
const TypeDropdown = ({ value, onChange }: { value: AllowedType; onChange: (val: AllowedType) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = TYPE_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm text-left transition-colors border-gray-300 dark:border-gray-700 ${
          open ? "ring-2 ring-brand-500/20 border-brand-500" : ""
        }`}
      >
        <span className="flex items-center gap-2 text-gray-900 dark:text-white">
          {selected?.value === "cash recived" ? (
            <FaArrowDown className="size-3 text-green-500" />
          ) : (
            <FaArrowUp className="size-3 text-red-500" />
          )}
          {selected?.label}
        </span>
        <FaChevronDown className={`size-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                value === opt.value
                  ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-2">
                {opt.value === "cash recived" ? (
                  <FaArrowDown className="size-3 text-green-500" />
                ) : (
                  <FaArrowUp className="size-3 text-red-500" />
                )}
                {opt.label}
              </span>
              {value === opt.value && <FaCheck className="size-3 text-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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

  const gridTemplateColumns = "80px 2fr 1fr 180px";

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
    if (!selectedCategory) return;
    try {
      await axiosSecure.delete(`/transaction-category/delete-transition-category/${selectedCategory.slug}`);
      toast.success(`Deleted "${selectedCategory.name}"`);
      fetchCategories();
    } catch {
      toast.error("Failed to delete category.");
    } finally {
      setShowDeleteModal(false);
      setSelectedCategory(null);
    }
  };

  const handleUpdate = async () => {
    if (!editedName.trim()) { toast.error("Category name cannot be empty."); return; }
    try {
      await axiosSecure.put(`/transaction-category/update-transition-category/${selectedCategory?.slug}`, {
        name: editedName.trim(),
        allowedType: editedType,
      });
      toast.success(`Updated to "${editedName.trim()}"`);
      setShowEditModal(false);
      fetchCategories();
    } catch {
      toast.error("Failed to update category.");
    }
  };

  const showSkeleton = isLoading;

  return (
    <div className="w-full space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-80 group">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 transition-colors group-focus-within:text-[#1D4ED8]" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-200 bg-transparent pl-9 pr-9 text-sm text-gray-700 outline-none transition-colors placeholder:text-gray-400 focus:border-[#1D4ED8] dark:border-gray-700 dark:text-gray-200"
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
            <Button onClick={fetchCategories} className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold">Try Again</Button>
          </div>
        )}

        {showSkeleton && !isError && (
          <div>
            <div className="grid border-b border-gray-200 dark:border-white/5 bg-gray-50/95 dark:bg-gray-800/95" style={{ gridTemplateColumns }}>
              {["Sr No.", "Category Name", "Type", "Actions"].map((h) => (
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
                    <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">#{index + 1}</span>
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
                      className="size-11 p-0 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-brand-400 hover:text-brand-500 hover:border-brand-400 dark:bg-brand-500/5 flex items-center justify-center"
                    >
                      <FaEdit className="size-4" />
                    </Button>
                    <Button
                      onClick={() => { setSelectedCategory(category); setShowDeleteModal(true); }}
                      size="sm"
                      className="size-11 p-0 rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 border-none"
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
                <div className="size-6 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
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
                    {["Sr No.", "Category Name", "Type", "Actions"].map((h) => (
                      <TableCell key={h} isHeader className="px-4 py-5 font-bold text-gray-500 text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                        {h}
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
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">#{virtualRow.index + 1}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white">{category.name}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            category.allowedType === "cash recived"
                              ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                              : "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400"
                          }`}>
                            {category.allowedType === "cash recived" ? "Cash Received" : "Cash Payment"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center gap-2">
                          <Tooltip text="Edit">
                            <Button
                              onClick={() => { setSelectedCategory(category); setEditedName(category.name); setEditedType(category.allowedType); setShowEditModal(true); }}
                              size="sm"
                              variant="outline"
                              className="size-10 p-0 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-brand-400 hover:text-brand-500 hover:border-brand-400 dark:bg-brand-500/5 transition-all active:scale-90 flex items-center justify-center"
                            >
                              <FaEdit className="size-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip text="Delete">
                            <Button
                              onClick={() => { setSelectedCategory(category); setShowDeleteModal(true); }}
                              size="sm"
                              className="size-10 p-0 rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
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
                <div className="size-6 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
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
            <Button onClick={handleDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg shadow-red-500/25 transition-all">
              Yes, Delete
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
            <TypeDropdown value={editedType} onChange={setEditedType} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
            <Button onClick={handleUpdate} className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all">
              Update
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TransactionCategoryTable;
