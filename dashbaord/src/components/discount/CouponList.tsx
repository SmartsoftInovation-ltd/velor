import { useQuery } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link, useNavigate } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import CouponTable from "../tables/DiscountTable/CouponTable";
import axiosSecure from "../../hooks/useAxiosSecure";
import { FaSync, FaArrowLeft } from "react-icons/fa";

const CouponSkeleton = () => (
  <div className="w-full animate-pulse">
    <div className="h-12 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 w-full max-w-md" />
    <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
      <div className="h-11 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-10 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="w-16 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-24 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-14 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-14 h-3.5 bg-gray-200 dark:bg-gray-700 rounded shrink-0" />
          <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full shrink-0" />
          <div className="flex gap-1.5">
            {[0, 1].map((j) => <div key={j} className="size-8 bg-gray-200 dark:bg-gray-700 rounded-2xl" />)}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const CouponList = () => {
  const canAdd = usePermission("coupon", "add");
  const navigate = useNavigate();

  const { data: coupons = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["coupons"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get(`/coupon/getallcoupon`);
        const items = data?.data?.coupons || data?.data || [];
        return Array.isArray(items) ? items : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000,
  });

  return (
    <>
      <PageMeta title="Baig Ecommerce Admin Dashboard" description="Coupon management" />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Coupon List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Go Back"
              aria-label="Go back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Refresh Coupons"
              aria-label="Refresh coupons"
            >
              <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            {canAdd && (
              <Link to="/create-coupon">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Create Coupon
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <CouponSkeleton />
          ) : isError ? (
            <div className="text-center py-20 min-h-100">
              <p className="text-red-500 font-bold mb-4">Error fetching coupons!</p>
              <button onClick={() => refetch()} className="shine px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold shadow-lg">
                Try Again
              </button>
            </div>
          ) : (
            <CouponTable coupons={coupons} fetchCoupons={() => refetch()} />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default CouponList;
