import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import OrderHistory from "../../components/tables/OrderTable/OrderHistory";
import OrderTable from "../../components/tables/OrderTable/OrderTable";

const OrderList = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Order Information" />
      <div className="space-y-6">
        <ComponentCard title="Order Metrics">
          <OrderHistory />
        </ComponentCard>
        <ComponentCard title="Order List">
          <OrderTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default OrderList;
