import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ProductTable from "../../components/tables/PrdouctTables/ProductTable";
import axiosSecure from "../../hooks/useAxiosSecure";
import { Link } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import { FaSync } from "react-icons/fa";
import { getApiErrorMessage } from "../../utils/apiError";

const COLS = 10;

const ProductSkeleton = () => (
  <div className="w-full animate-pulse">
    <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 w-full max-w-md" />
    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
      <div className="h-11 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-20 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-20 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="size-10 bg-gray-200 dark:bg-gray-700 rounded-lg shrink-0" />
          <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          {Array.from({ length: COLS - 4 }).map((_, j) => (
            <div key={j} className="w-16 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const ProductList = () => {
  const canAdd = usePermission("product", "add");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // One page at a time from the server, newest first; the search (a word of
  // the name, or a barcode / sku) runs there too (BUG-P2-010)
  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPlaceholderData,
  } = useInfiniteQuery({
    queryKey: ["products", debouncedSearch],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const { data } = await axiosSecure.get("/product/getproduct", {
        params: { limit: 50, after: pageParam, search: debouncedSearch.trim() || undefined },
      });
      return data?.data as { products: Parameters<typeof ProductTable>[0]["products"]; nextCursor: string | null };
    },
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
    staleTime: 2 * 60 * 1000,
    // Keep showing the current rows while the next search loads, instead of
    // swapping the whole card (search box included) for a skeleton each time
    placeholderData: keepPreviousData,
  });
  // Typed but not yet sent, or sent and loading
  const searching =
    searchTerm.trim() !== debouncedSearch.trim() || (isFetching && isPlaceholderData);
  const products = data?.pages.flatMap((p) => p?.products ?? []) ?? [];

  const handleSearch = (query?: string) => {
    const val = query || "";
    setSearchTerm(val);
    setDebouncedSearch(val);
  };

  return (
    <>
      <PageMeta title="Baig Ecommerce Admin Dashboard" description="Product management" />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Product List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Refresh Products"
              aria-label="Refresh products"
            >
              <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            {canAdd && (
              <Link to="/create-product">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Create Product
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <ProductSkeleton />
          ) : isError ? (
            <div className="text-center py-20 min-h-100">
              <p className="text-red-500 font-bold mb-4">{getApiErrorMessage(error, "Error fetching products!")}</p>
              <Button size="sm" onClick={() => refetch()} className="!bg-accent-500 hover:!bg-accent-600 !text-white rounded-xl px-6">
                Try Again
              </Button>
            </div>
          ) : (
            <ProductTable
              products={products}
              fetchProducts={handleSearch}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              hasMore={hasNextPage}
              loadingMore={isFetchingNextPage}
              onLoadMore={() => fetchNextPage()}
              searching={searching}
            />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default ProductList;
