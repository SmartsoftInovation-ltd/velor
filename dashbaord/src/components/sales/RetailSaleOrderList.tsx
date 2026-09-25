import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import SalesHistoryTable from "../tables/SalesTable/SalesHistoryTable";

// Retail sale order list — same table as the sales history, but restricted to
// retailsaleorder rows (pending orders). The backend filters via
// ?salesType=retailsaleorder.
const RetailSaleOrderList = () => {
  const canAdd = usePermission("retail-sale-order", "add");
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Retail Sale Order List" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-md font-medium">Retail Sale Order List</h2>
              {canAdd && (
                <Link to="/retail-sale-order">
                  <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                    Create Retail Sale Order
                  </Button>
                </Link>
              )}
            </div>
          }
        >
          {/* Opens on pending orders — see SaleOrderList for the reasoning. */}
          <SalesHistoryTable
            salesType="retailsaleorder"
            defaultInvoiceStatus="pending"
          />
        </ComponentCard>
      </div>
    </>
  );
};

export default RetailSaleOrderList;
