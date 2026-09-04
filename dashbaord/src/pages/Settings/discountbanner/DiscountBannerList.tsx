import { useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft, FaSync } from "react-icons/fa";
import { Link, useNavigate } from "react-router";
import { usePermission } from "../../../hooks/usePermission";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import DiscountBannerTable from "../../../components/tables/DiscountBannerTable/DiscountBannerTable";

const DiscountBannerList = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canAdd = usePermission("discount-banner", "add");
  return (
    <>
      <PageMeta
        title="Discount Banner List | Admin Dashboard"
        description="View all discount banners added to your ecommerce website"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Discount Banner List"
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
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["discount-banners"] })
              }
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/add-discount">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                  Add Discount Banner
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <DiscountBannerTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default DiscountBannerList;
