import { useCallback, useState } from "react";
import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import OrderHistory from "../../components/tables/OrderTable/OrderHistory";
import OrderTable from "../../components/tables/OrderTable/OrderTable";
import { usePermission } from "../../hooks/usePermission";

const OrderList = () => {
  const canAdd = usePermission("order", "add");
  // The pipeline tiles filter the table; null shows every status
  const [status, setStatus] = useState<string | null>(null);
  const [statsVersion, setStatsVersion] = useState(0);
  const refreshStats = useCallback(() => setStatsVersion((v) => v + 1), []);

  return (
    <>
      <PageMeta title="Orders · Baig Ecommerce Admin Dashboard" description="Orders from the storefront and the counter" />
      <PageBreadcrumb
        pageTitle="Order List"
        className="mb-3"
        hideTitle
        actions={
          canAdd ? (
            <Link to="/create-order">
              <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                Create Order
              </Button>
            </Link>
          ) : null
        }
      />
      <div className="space-y-6">
        <OrderHistory active={status} onSelect={setStatus} refreshKey={statsVersion} />
        <ComponentCard>
          <OrderTable statusFilter={status} onDataChanged={refreshStats} />
        </ComponentCard>
      </div>
    </>
  );
};

export default OrderList;
