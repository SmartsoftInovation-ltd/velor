import { useState } from "react";
import { FaArrowLeft, FaSync } from "react-icons/fa";
import { Link, useNavigate } from "react-router";
import { usePermission } from "../../../hooks/usePermission";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import SiteInfoTable from "../../../components/tables/SiteInfoTable/SiteInfoTable";
import Button from "../../../components/ui/button/Button";

const SiteInfoList = () => {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const canAdd = usePermission("site-information", "add");
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is the site information list page for Baig Digital"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Site Information List"
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
              onClick={() => setReloadKey((k) => k + 1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/add-site-info">
                <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
                  Add Site Info
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <SiteInfoTable key={reloadKey} />
        </ComponentCard>
      </div>
    </>
  );
};

export default SiteInfoList;
