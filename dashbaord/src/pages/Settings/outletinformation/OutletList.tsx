import { useState } from "react";
import { FaArrowLeft, FaSync } from "react-icons/fa";
import { Link, useNavigate } from "react-router";
import { usePermission } from "../../../hooks/usePermission";
import ComponentCard from "../../../components/common/ComponentCard";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";

import Button from "../../../components/ui/button/Button";
import OutletInfoTable from "../../../components/tables/OutletTable/OutletTable";

const OutletInfoList = () => {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const canAdd = usePermission("outlet-information", "add");
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is the outlet information list page for Baig Digital"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Outlet Information List"
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
              onClick={() => setReloadKey((k) => k + 1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Refresh"
              aria-label="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/add-outlet">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Add Outlet Info
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <OutletInfoTable key={reloadKey} />
        </ComponentCard>
      </div>
    </>
  );
};

export default OutletInfoList;
