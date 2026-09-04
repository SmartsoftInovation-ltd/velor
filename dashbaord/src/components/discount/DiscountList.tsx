import { useQuery } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DiscountTable from "../../components/tables/DiscountTable/DiscountTable";
import axiosSecure from "../../hooks/useAxiosSecure";
import { Link, useNavigate } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import { FaSync, FaArrowLeft } from "react-icons/fa";

const DiscountSkeleton = () => (
  <div className="w-full animate-pulse">
    <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 w-full max-w-md" />
    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
      <div className="h-11 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-10 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
          <div className="w-20 h-5 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
          <div className="w-16 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-20 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-20 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-14 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-14 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  </div>
);

const DiscountList = () => {
  const canAdd = usePermission("discount", "add");
  const navigate = useNavigate();
  const { data: discounts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["discounts"],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/discount`);
      const items = data.data?.discounts || data.data || [];
      return Array.isArray(items) ? items : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <>
      <PageMeta title="Baig Ecommerce Admin Dashboard" description="Discount management" />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Discount List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Refresh Discounts"
            >
              <FaSync className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            {canAdd && (
              <Link to="/create-discount">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                  Create Discount
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <DiscountSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-24 text-center min-h-100">
              <div className="size-20 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center mb-6">
                <svg className="size-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Failed to load discounts</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-8">
                We encountered a problem while trying to fetch the discount records. Please try again.
              </p>
              <Button
                onClick={() => refetch()}
                className="px-8 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold shadow-lg shadow-brand-500/25 transition-all active:scale-95"
              >
                Try Again
              </Button>
            </div>
          ) : (
            <DiscountTable discounts={discounts} fetchDiscounts={() => refetch()} />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default DiscountList;
