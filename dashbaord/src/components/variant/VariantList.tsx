import { useState } from "react";
import { Link } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaSync } from "react-icons/fa";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import VariantTable from "../../components/tables/VariantTable/VariantTable";
import Button from "../ui/button/Button";
import { showApiError } from "../../utils/apiError";

const VariantList = () => {
  const canAdd = usePermission("variant", "add");
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["variants"] });
      toast.success("Variant list refreshed!");
    } catch (err) {
      showApiError(err, "Failed to refresh variants.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Variant List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Refresh Variants"
              aria-label="Refresh variants"
            >
              <FaSync className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            {canAdd && (
              <Link to="/create-variant">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Create Variant
                </Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        <ComponentCard>
          <VariantTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default VariantList;


