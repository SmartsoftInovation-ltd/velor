import { useRef, useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaEdit, FaSearch, FaTimes } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { IoIosPrint } from "react-icons/io";
import { Link } from "react-router";
import toast from "react-hot-toast";
import moment from "moment";
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
import Tooltip from "../../common/Tooltip";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

interface Transaction {
  _id: string;
  transactionSerialId?: string;
  date: string;
  transactionCategory: { _id: string; name: string } | null;
  account: { _id: string; name: string } | null;
  transactionDescription: string;
  transactionType: string;
  amount: number;
}

interface TransactionPage {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

interface EditState {
  date: string;
  transactionDescription: string;
  transactionType: string;
  amount: string;
}

const PAGE_LIMIT = 50;


const TransactionListTable = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [editState, setEditState] = useState<EditState>({ date: "", transactionDescription: "", transactionType: "", amount: "" });
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = useInfiniteQuery<TransactionPage>({
    queryKey: ["transactions"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axiosSecure.get(
        `/transaction/get-alltransaction?page=${pageParam}&limit=${PAGE_LIMIT}`
      );
      return res.data.data as TransactionPage;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: "always",
  });

  const fetchTransactions = () => {
    queryClient.resetQueries({ queryKey: ["transactions"] });
  };

  const allTransactions = data?.pages.flatMap((p) => p.transactions) ?? [];

  const filtered = allTransactions.filter((t) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.transactionCategory?.name?.toLowerCase().includes(q) ||
      t.account?.name?.toLowerCase().includes(q) ||
      t.transactionType?.toLowerCase().includes(q) ||
      t.transactionDescription?.toLowerCase().includes(q) ||
      t.transactionSerialId?.toLowerCase().includes(q)
    );
  });

  // Header and every row are separate grids, so columns must not size from
  // content: `1fr` grows to fit its widest cell, and the virtualizer swaps rows
  // in and out, which shifted headings sideways while scrolling. minmax(0, …)
  // and a fixed Actions width keep them identical; long values are truncated.
  const gridTemplateColumns = "repeat(7, minmax(0, 1fr)) 168px";

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
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

  const openDeleteModal = (tx: Transaction) => {
    setSelectedTx(tx);
    setShowDeleteModal(true);
  };

  const openEditModal = (tx: Transaction) => {
    setSelectedTx(tx);
    setEditState({
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 16) : "",
      transactionDescription: tx.transactionDescription || "",
      transactionType: tx.transactionType || "",
      amount: tx.amount?.toString() || "",
    });
    setShowEditModal(true);
  };

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running:
    // the row would already be gone and the retry would answer "not found".
    if (!selectedTx || isDeleting) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/transaction/delete-transaction/${selectedTx._id}`);
      toast.success("Transaction deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
      // Every dashboard widget, not just the balance box: each is keyed by
      // range, so a prefix match is what refreshes the one on screen.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      fetchTransactions();
      setShowDeleteModal(false);
      setSelectedTx(null);
    } catch (error) {
      // The modal stays open on failure, so the row is still there to retry.
      showApiError(error, "Failed to delete transaction.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdate = async () => {
    // Guard against a second click while the first request is still running.
    if (isUpdating) return;
    if (!selectedTx) return;
    setIsUpdating(true);
    try {
      await axiosSecure.put(`/transaction/update-transaction/${selectedTx._id}`, {
        date: editState.date,
        transactionDescription: editState.transactionDescription,
        transactionType: editState.transactionType,
        amount: Number(editState.amount),
        transactionCategory: selectedTx.transactionCategory?._id,
        account: selectedTx.account?._id,
      });
      toast.success("Transaction updated successfully.");
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
      // Every dashboard widget, not just the balance box: each is keyed by
      // range, so a prefix match is what refreshes the one on screen.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      fetchTransactions();
    } catch (error) {
      showApiError(error, "Failed to update transaction.");
    } finally {
      setIsUpdating(false);
    }
  };

  const showSkeleton = isLoading;
  const headers = ["Serial ID", "Date", "Category", "Account", "Type", "Amount", "Description", "Actions"];

  return (
    <div className="w-full space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-80 group">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 transition-colors group-focus-within:text-accent-500" />
          <input
            type="text"
            placeholder="Search by serial, category, account, type..."
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
            <p className="text-red-500 font-bold text-lg mb-4">Failed to load transactions!</p>
            <Button onClick={fetchTransactions} className="px-6 py-2 bg-accent-500 text-white rounded-xl font-bold">Try Again</Button>
          </div>
        )}

        {showSkeleton && !isError && (
          <div>
            <div className="grid border-b border-gray-200 dark:border-white/5 bg-gray-50/95 dark:bg-gray-800/95" style={{ gridTemplateColumns }}>
              {headers.map((h) => (
                <div key={h} className="px-4 py-5 font-bold text-gray-500 text-[11px] uppercase dark:text-gray-400 text-center">{h}</div>
              ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="grid border-b border-gray-100 dark:border-white/5 animate-pulse" style={{ gridTemplateColumns }}>
                {Array.from({ length: 8 }).map((_, j) => (
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
              getKey={(tx) => tx._id}
              emptyMessage="No transactions found"
              renderCard={(tx, index) => {
                const isIncome = tx.transactionType === "cash recived";
                return (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/5">
                      <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                        {tx.transactionSerialId || `#${index + 1}`}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${isIncome ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"}`}>
                        {isIncome ? "In" : "Out"}
                      </span>
                    </div>
                    <MobileCardRow label="Date">{moment(tx.date).format("DD MMM YYYY")}</MobileCardRow>
                    <MobileCardRow label="Category">{tx.transactionCategory?.name || "—"}</MobileCardRow>
                    <MobileCardRow label="Account">{tx.account?.name || "—"}</MobileCardRow>
                    <MobileCardRow label="Amount">
                      <span className={`font-bold ${isIncome ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                        ৳{tx.amount?.toLocaleString()}
                      </span>
                    </MobileCardRow>
                    {tx.transactionDescription && (
                      <MobileCardRow label="Description">{tx.transactionDescription}</MobileCardRow>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/5">
                      <Link to={`/transaction-print/${tx._id}`} className="shine flex size-10 items-center justify-center rounded transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 max-md:size-11" aria-label="Print transaction voucher">
                        <IoIosPrint className="size-4" />
                      </Link>
                      <Button
                        onClick={() => openEditModal(tx)}
                        size="sm"
                        variant="outline"
                        className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                        aria-label="Edit transaction"
                      >
                        <FaEdit className="size-4" />
                      </Button>
                      <Button
                        onClick={() => openDeleteModal(tx)}
                        size="sm"
                        className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                        aria-label="Delete transaction"
                      >
                        <MdDelete className="size-5" />
                      </Button>
                    </div>
                  </div>
                );
              }}
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
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">No Transactions Found</h3>
                {searchTerm ? (
                  <Button onClick={() => setSearchTerm("")} variant="outline" className="rounded-xl px-6 py-2 text-sm font-semibold mt-4">Clear Search</Button>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No transaction records yet.</p>
                )}
              </div>
            ) : (
              <Table className="w-full" style={{ minWidth: 900 }}>
                <TableHeader className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/5 backdrop-blur-md">
                  <TableRow className="grid" style={{ gridTemplateColumns }}>
                    {headers.map((h) => (
                      <TableCell key={h} isHeader className="px-4 py-5 font-bold text-gray-500 text-[11px] uppercase dark:text-gray-400 flex min-w-0 items-center justify-center">
                        <span className="truncate" title={h}>{h}</span>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const tx = filtered[virtualRow.index];
                    if (!tx) return null;
                    const isIncome = tx.transactionType === "cash recived";
                    return (
                      <TableRow
                        key={tx._id}
                        className="absolute top-0 left-0 w-full grid hover:bg-gray-50 dark:hover:bg-white/2 transition-colors border-b border-gray-100 dark:border-white/5"
                        style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)`, gridTemplateColumns }}
                      >
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400 max-w-full truncate" title={tx.transactionSerialId || `#${virtualRow.index + 1}`}>{tx.transactionSerialId || `#${virtualRow.index + 1}`}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 max-w-full truncate" title={moment(tx.date).format("DD MMM YYYY")}>{moment(tx.date).format("DD MMM YYYY")}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-full truncate" title={tx.transactionCategory?.name || "—"}>{tx.transactionCategory?.name || "—"}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-full truncate" title={tx.account?.name || "—"}>{tx.account?.name || "—"}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className={`max-w-full truncate text-xs font-bold px-2 py-1 rounded-lg ${isIncome ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"}`}>
                            {isIncome ? "In" : "Out"}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className={`max-w-full truncate text-sm font-bold ${isIncome ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                            ৳{tx.amount?.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex min-w-0 items-center justify-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400 max-w-full truncate" title={tx.transactionDescription || "—"}>{tx.transactionDescription || "—"}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex flex-nowrap min-w-0 items-center justify-center gap-2">
                          <Tooltip text="Print">
                            <Link to={`/transaction-print/${tx._id}`} className="shine flex size-10 items-center justify-center rounded transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10" aria-label="Print transaction voucher">
                              <IoIosPrint className="size-4" />
                            </Link>
                          </Tooltip>
                          <Tooltip text="Edit">
                            <Button
                              onClick={() => openEditModal(tx)}
                              size="sm"
                              variant="outline"
                              className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                              aria-label="Edit transaction"
                            >
                              <FaEdit className="size-4" />
                            </Button>
                          </Tooltip>
                          <Tooltip text="Delete">
                            <Button
                              onClick={() => openDeleteModal(tx)}
                              size="sm"
                              className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                              aria-label="Delete transaction"
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
      <Modal
        isOpen={showDeleteModal}
        // Closing mid-request would hide a delete that is still running
        onClose={() => !isDeleting && setShowDeleteModal(false)}
      >
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Transaction?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
            Are you sure you want to <span className="font-semibold text-red-500">delete</span> this transaction?
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 !bg-error-500 hover:!bg-error-600 !text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:opacity-60 disabled:active:scale-100"
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

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)}>
        <div className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Transaction</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <input
                type="datetime-local"
                value={editState.date}
                onChange={(e) => setEditState((p) => ({ ...p, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
              />
            </div>
            <div>
              <Label>Transaction Type</Label>
              <SearchableSelect
                options={[
                  { value: "cash recived", label: "Cash Received" },
                  { value: "cash payment", label: "Cash Payment" },
                ]}
                value={editState.transactionType}
                onChange={(v) => setEditState((p) => ({ ...p, transactionType: v }))}
                placeholder="Select type"
                searchPlaceholder="Search types..."
              />
            </div>
            <div>
              <Label>Amount</Label>
              <InputField
                type="number"
                value={editState.amount}
                onChange={(e) => setEditState((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <InputField
                value={editState.transactionDescription}
                onChange={(e) => setEditState((p) => ({ ...p, transactionDescription: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Category and account cannot be changed after creation.</p>
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

export default TransactionListTable;
