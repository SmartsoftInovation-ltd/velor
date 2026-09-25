import { FaArrowLeft, FaSync } from "react-icons/fa";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePermission } from "../../../hooks/usePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import BannerTable, { type Banner } from "../../../components/tables/BannerTable/BannerTable";
import axiosSecure from "../../../hooks/useAxiosSecure";

const BannerList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("create-banner", "add");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: allBanners = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<Banner[]>({
    queryKey: ["banners"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/banner/all-banner");
        return data?.data?.banners || data?.data || [];
      } catch (err: any) {
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const banners = searchTerm.trim()
    ? allBanners.filter((b) => {
        const q = searchTerm.toLowerCase();
        return (
          b.title?.toLowerCase().includes(q) ||
          b.headLine?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q)
        );
      })
    : allBanners;

  const fetchBanners = () => {
    queryClient.invalidateQueries({ queryKey: ["banners"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="Banner List | Admin Dashboard"
        description="View all banners added to your ecommerce website"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Banner List"
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
              aria-label="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button
              onClick={() => refetch()}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Refresh"
              aria-label="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/add-banner">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Add Banner
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <div className="flex justify-center items-center min-h-[400px]">
              <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-bold mb-4">Failed to load banners!</p>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-accent-500 text-white rounded-xl font-bold"
              >
                Try Again
              </button>
            </div>
          ) : (
            <BannerTable
              banners={banners}
              fetchBanners={fetchBanners}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isFetching={isFetching}
            />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default BannerList;
