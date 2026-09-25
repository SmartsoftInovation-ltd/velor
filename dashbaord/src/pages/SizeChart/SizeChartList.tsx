import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft, FaSync } from "react-icons/fa";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import SizeChartTable from "../../components/tables/SizeChartTable/SizeChartTable";
import axiosSecure from "../../hooks/useAxiosSecure";
import Button from "../../components/ui/button/Button";
import { usePermission } from "../../hooks/usePermission";

const gridCols = "70px 2fr 130px 1.5fr 70px 70px 110px 120px 200px";

const SizeChartSkeleton = () => (
  <div className="w-full animate-pulse">
    {/* toolbar */}
    <div className="flex items-center justify-between mb-5">
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      <div className="flex gap-2">
        <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
        <div className="h-9 w-40 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
    {/* search bar */}
    <div className="h-10 w-full bg-gray-100 dark:bg-gray-800 rounded-xl mb-4" />
    {/* header row */}
    <div
      className="grid gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl mb-1"
      style={{ gridTemplateColumns: gridCols }}
    >
      {["w-6", "w-16", "w-20", "w-20", "w-8", "w-8", "w-16", "w-14", "w-24"].map((w, i) => (
        <div key={i} className={`h-3 ${w} bg-gray-300 dark:bg-gray-600 rounded mx-auto`} />
      ))}
    </div>
    {/* data rows */}
    {Array.from({ length: 7 }).map((_, i) => (
      <div
        key={i}
        className="grid gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800 items-center"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="h-3.5 w-6 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
        <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg mx-auto" />
        <div className="flex gap-1.5 justify-center">
          <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-md" />
          <div className="h-5 w-10 bg-gray-200 dark:bg-gray-700 rounded-md" />
        </div>
        <div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
        <div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded mx-auto" />
        <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
        <div className="flex gap-1.5 justify-center">
          {[0, 1, 2, 3].map((j) => (
            <div key={j} className="size-8 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

const SizeChartList = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canAdd = usePermission("sizechart", "add");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const { data: sizeCharts, isLoading, isError, refetch } = useQuery({
    queryKey: ["sizeCharts", debouncedSearch],
    queryFn: async () => {
      const endpoint = debouncedSearch
        ? `/sizechart/search-sizechart?query=${debouncedSearch}`
        : `/sizechart/get-sizechart`;
      const { data } = await axiosSecure.get(endpoint);
      return data.data.sizeCharts;
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <>
      <PageMeta
        title="Size Chart Management - Baig Ecommerce"
        description="Manage product size charts"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Size Chart Management"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/create-sizechart">
                <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
                  Create Size Chart
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <SizeChartSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-24 text-center min-h-100">
              <div className="size-20 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
                <svg className="size-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load size charts</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-8">
                We encountered a problem while trying to fetch the size chart records. Please try again.
              </p>
              <button
                onClick={() => refetch()}
                className="px-8 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/25 transition-all active:scale-95"
              >
                Try Again
              </button>
            </div>
          ) : (
            <SizeChartTable
              sizeCharts={sizeCharts}
              fetchSizeCharts={() => {
                queryClient.invalidateQueries({ queryKey: ["sizeCharts"] });
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

export default SizeChartList;
