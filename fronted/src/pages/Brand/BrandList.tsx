import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";
import { FaSync } from "react-icons/fa";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import BrandTable from "../../components/tables/BrandTable/BrandTable";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "../../components/ui/button/Button";
import { usePermission } from "../../hooks/usePermission";

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setVisible(true);
    }
  };
  return (
    <div ref={ref} onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)} className="relative inline-block">
      {children}
      {visible && createPortal(
        <div className="fixed z-[9999] px-3 py-1.5 text-[11px] font-bold text-white bg-gray-900 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{ left: coords.x, top: coords.y }}>
          {text}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900" />
        </div>,
        document.body
      )}
    </div>
  );
};

const GRID = "80px 2fr 1fr 1.5fr 120px 220px";

const BrandSkeleton = () => (
  <div className="w-full animate-pulse">
    <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 w-full max-w-sm" />
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="h-11 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800" />
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="grid items-center px-4 py-3.5 border-b border-gray-100 dark:border-gray-800 gap-3"
          style={{ gridTemplateColumns: GRID }}>
          <div className="h-3.5 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
          <div className="flex items-center gap-3">
            <div className="size-9 bg-gray-200 dark:bg-gray-700 rounded-xl shrink-0" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
          </div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mx-auto" />
          <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
          <div className="flex gap-1.5 justify-center">
            {[0, 1, 2, 3].map((j) => <div key={j} className="size-8 bg-gray-200 dark:bg-gray-700 rounded-2xl" />)}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const BrandList = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const canAdd = usePermission("brand", "add");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: brands, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["brands", debouncedSearch],
    queryFn: async () => {
      const endpoint = debouncedSearch
        ? `/brand/search?q=${debouncedSearch}`
        : `/brand`;
      const { data } = await axiosSecure.get(endpoint);
      return data.data.brands;
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <>
      <PageMeta title="Brand Management - Baig Ecommerce" description="Manage your product brands" />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Brand Management"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Tooltip text="Refresh Brands">
              <Button
                onClick={() => refetch()}
                size="sm"
                variant="outline"
                className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              >
                <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </Tooltip>
            {canAdd && (
              <Link to="/create-brand">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                  Create Brand
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <BrandSkeleton />
          ) : isError ? (
            <div className="text-center py-20 min-h-100">
              <p className="text-red-500 font-bold mb-4">Error fetching brands!</p>
              <button onClick={() => refetch()} className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold shadow-lg">
                Try Again
              </button>
            </div>
          ) : (
            <BrandTable
              brands={brands}
              fetchBrands={() => {
                queryClient.invalidateQueries({ queryKey: ["brands"] });
                refetch();
              }}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default BrandList;
