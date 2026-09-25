import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import StockAdjustmentList from "../tables/StockTables/StockAdjustmentList";
import Button from "../ui/button/Button";
import { usePermission } from "../../hooks/usePermission";

const StockList = () => {
  const canAdd = usePermission("stock-adjustment", "add");
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Stock Adjustment List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 !rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Go Back"
              aria-label="Go back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/stock-adjustment">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 !rounded">
                  Stock Adjustment
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <StockAdjustmentList />
        </ComponentCard>
      </div>
    </>
  );
};

export default StockList;
