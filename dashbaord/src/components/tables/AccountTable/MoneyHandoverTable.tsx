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
import { Modal } from "../../ui/modal";
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

interface FundHandover {
  _id: string;
  handoverSerialId?: string;
  date: string;
  name: string;
  amount: number;
  voucherNumber: string;
  transactionDescription: string;
  fundPaymentMode?: { _id: string; name: string } | null;
}

interface FundHandoverPage {
  funds: FundHandover[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

const PAGE_LIMIT = 50;


const MoneyHandoverTable = () => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = useInfiniteQuery<FundHandoverPage>({
    queryKey: ["fund-handovers"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axiosSecure.get(
        `/fundhandover/getall-fundhandover?page=${pageParam}&limit=${PAGE_LIMIT}`
      );
      return res.data.data as FundHandoverPage;
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: "always",
  });

  const fetchHandovers = () => {
    queryClient.resetQueries({ queryKey: ["fund-handovers"] });
  };

  const allHandovers = data?.pages.flatMap((p) => p.funds) ?? [];

  const filtered = allHandovers.filter((h) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      h.name?.toLowerCase().includes(q) ||
      h.voucherNumber?.toLowerCase().includes(q) ||
      h.transactionDescription?.toLowerCase().includes(q) ||
      h.handoverSerialId?.toLowerCase().includes(q)
    );
  });

  const gridTemplateColumns = "1fr 1fr 1fr 1fr 1fr 1fr 1fr";

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

  const handleDeleteModal = (id: string) => {
    setSelectedId(id);
    setShowDeleteModal(true);
  };

  const closeModal = () => {
    setShowDeleteModal(false);
    setSelectedId(null);
  };

  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/fundhandover/delete-fundhandover/${selectedId}`);
      toast.success("Money handover deleted successfully.");
      fetchHandovers();
    } catch (error) {
      showApiError(error, "Failed to delete the money handover.");
    } finally {
      setIsDeleting(false);
      closeModal();
    }
  };

  const showSkeleton = isLoading;
  const headers = ["Serial ID", "Date", "Name", "Amount", "Voucher No.", "Description", "Actions"];

  return (
    <div className="w-full space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-80 group">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 transition-colors group-focus-within:text-accent-500" />
          <input
            type="text"
            placeholder="Search by serial, name, voucher..."
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
           <div className="flex flex-col items-center justify-center py-24 text-center min-h-[400px]">
            <div className="size-20 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
              <svg className="size-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load Money handovers</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-8">
              We encountered a problem while trying to fetch the money handover records. Please try again.
            </p>
            <Button 
              onClick={fetchHandovers} 
                className="px-8 py-2.5 !bg-accent-500 hover:!bg-accent-600 !text-white rounded-xl font-semibold shadow-lg transition-all active:scale-95"
            >
              Try Again
            </Button>
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
                {Array.from({ length: 7 }).map((_, j) => (
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
              getKey={(item) => item._id}
              emptyMessage="No fund handover records yet"
              renderCard={(item, index) => (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-gray-100 dark:border-white/5">
                    <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">
                      {item.handoverSerialId || `#${index + 1}`}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{moment(item.date).format("DD MMM YYYY")}</span>
                  </div>
                  <MobileCardRow label="Name">{item.name}</MobileCardRow>
                  <MobileCardRow label="Amount">
                    <span className="font-bold text-green-600 dark:text-green-400">৳{item.amount?.toLocaleString()}</span>
                  </MobileCardRow>
                  <MobileCardRow label="Voucher No.">{item.voucherNumber || "—"}</MobileCardRow>
                  {item.transactionDescription && (
                    <MobileCardRow label="Description">{item.transactionDescription}</MobileCardRow>
                  )}
                  <div className="flex items-center justify-end gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-white/5">
                    <Link to={`/money-handover-print/${item._id}`} className="shine flex size-10 items-center justify-center rounded transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 max-md:size-11" aria-label="Print handover voucher">
                      <IoIosPrint className="size-4" />
                    </Link>
                    <Link to={`/update-money-handover/${item._id}`}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                        aria-label="Edit handover"
                      >
                        <FaEdit className="size-4" />
                      </Button>
                    </Link>
                    <Button
                      onClick={() => handleDeleteModal(item._id)}
                      size="sm"
                      className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                      aria-label="Delete handover"
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
            className="no-scrollbar max-w-full overflow-y-auto overflow-x-hidden max-h-[650px] relative"
            style={{ minHeight: filtered.length === 0 ? "300px" : "auto" }}
          >
            {filtered.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-10 text-center">
                <div className="size-16 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center mb-4">
                  <FaSearch className="size-7 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">No Handovers Found</h3>
                {searchTerm ? (
                  <Button onClick={() => setSearchTerm("")} variant="outline" className="rounded-xl px-6 py-2 text-sm font-semibold mt-4">Clear Search</Button>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No fund handover records yet.</p>
                )}
              </div>
            ) : (
              <Table className="w-full">
                <TableHeader className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/5 backdrop-blur-md">
                  <TableRow className="grid" style={{ gridTemplateColumns }}>
                    {headers.map((h) => (
                      <TableCell key={h} isHeader className="px-4 py-5 font-bold text-gray-500 text-[11px] uppercase dark:text-gray-400 flex items-center justify-center">
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="relative w-full" style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const item = filtered[virtualRow.index];
                    if (!item) return null;
                    return (
                      <TableRow
                        key={item._id}
                        className="absolute top-0 left-0 w-full grid hover:bg-gray-50 dark:hover:bg-white/2 transition-colors border-b border-gray-100 dark:border-white/5"
                        style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)`, gridTemplateColumns }}
                      >
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">{item.handoverSerialId || `#${virtualRow.index + 1}`}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{moment(item.date).format("DD MMM YYYY")}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className="text-sm font-semibold text-gray-800 dark:text-white">{item.name}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className="text-sm font-bold text-green-600 dark:text-green-400">৳{item.amount?.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{item.voucherNumber || "—"}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center">
                          <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{item.transactionDescription || "—"}</span>
                        </TableCell>
                        <TableCell className="px-4 py-3 flex items-center justify-center gap-2">
                          <Tooltip text="Print">
                            <Link to={`/money-handover-print/${item._id}`} className="shine flex size-10 items-center justify-center rounded transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10" aria-label="Print handover voucher">
                              <IoIosPrint className="size-4" />
                            </Link>
                          </Tooltip>
                          <Tooltip text="Edit">
                            <Link to={`/update-money-handover/${item._id}`}>
                              <Button
                                size="sm"
                                variant="outline"
                                  className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                                  aria-label="Edit handover"
                                >
                                <FaEdit className="size-4" />
                              </Button>
                            </Link>
                          </Tooltip>
                          <Tooltip text="Delete">
                            <Button
                              onClick={() => handleDeleteModal(item._id)}
                              size="sm"
                              className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                              aria-label="Delete handover"
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
      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Handover?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to <span className="font-semibold text-red-500">delete</span> this fund handover record?
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
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
    </div>
  );
};

export default MoneyHandoverTable;
