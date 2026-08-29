import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import SalesHistoryTable from "../tables/SalesTable/SalesHistoryTable";

// Combined order list — retail and wholesale sale orders in one table. The
// backend accepts a comma-separated salesType, so both kinds arrive together
// and the table's own type filter separates them.
const SaleOrderList = () => {
  const canAddRetail = usePermission("retail-sale-order", "add");
  const canAddWholesale = usePermission("whole-sale-order", "add");

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Order List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
            {canAddRetail && (
              <Link to="/retail-sale-order" className="w-full sm:w-auto">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded w-full sm:w-auto">
                  Create Retail Sale Order
                </Button>
              </Link>
            )}
            {canAddWholesale && (
              <Link to="/whole-sale-order" className="w-full sm:w-auto">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded w-full sm:w-auto">
                  Create Wholesale Order
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <SalesHistoryTable salesType="retailsaleorder,wholesaleorder" />
        </ComponentCard>
      </div>
    </>
  );
};

export default SaleOrderList;
