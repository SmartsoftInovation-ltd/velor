import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { FaSearch } from "react-icons/fa";
import axiosSecure from "../../../hooks/useAxiosSecure";

interface PageResult<T> {
  items: T[];
  page: number;
  hasNextPage: boolean;
}

interface InfiniteSearchListProps<T> {
  queryKey: string;
  endpoint: string;
  extractPage: (raw: { data?: Record<string, unknown> }, page: number) => PageResult<T>;
  limit?: number;
  renderRow: (item: T, isSelected: boolean) => React.ReactNode;
  isSelected: (item: T) => boolean;
  onSelect: (item: T) => void;
  getKey: (item: T) => string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  rowHeight?: number;
  maxHeight?: number;
  minHeight?: number;
}

function InfiniteSearchList<T>({
  queryKey,
  endpoint,
  extractPage,
  limit = 30,
  renderRow,
  isSelected,
  onSelect,
  getKey,
  searchPlaceholder = "Search...",
  emptyLabel = "No results found",
  rowHeight = 64,
  maxHeight = 320,
  minHeight,
}: InfiniteSearchListProps<T>) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(handler);
  }, [search]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    isError,
  } = useInfiniteQuery({
    queryKey: [queryKey, debouncedSearch],
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const res = await axiosSecure.get(endpoint, {
        params: { page, limit, search: debouncedSearch || undefined },
      });
      return extractPage(res.data, page);
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 2 * 60 * 1000,
  });

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
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

  return (
    <div className="space-y-2">
      <div className="relative">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all placeholder:text-gray-400 dark:text-white"
        />
      </div>

      <div
        ref={parentRef}
        className="overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800 custom-scrollbar"
        style={{ maxHeight, minHeight }}
      >
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="size-6 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          </div>
        ) : isError ? (
          <div className="py-8 text-center text-xs text-red-500 font-medium">
            Failed to load results
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400 font-medium">
            {emptyLabel}
          </div>
        ) : (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = items[virtualRow.index];
              const selected = isSelected(item);
              return (
                <div
                  key={getKey(item)}
                  className={`absolute top-0 left-0 w-full cursor-pointer transition-colors ${
                    selected
                      ? "bg-brand-50 dark:bg-brand-500/10"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  }`}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onClick={() => onSelect(item)}
                >
                  {renderRow(item, selected)}
                </div>
              );
            })}
          </div>
        )}
        <div ref={sentinelRef} />
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <div className="size-4 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

export default InfiniteSearchList;
