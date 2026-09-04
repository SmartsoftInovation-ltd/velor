import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import IncompleteOrderTable from "../../components/tables/OrderTable/IncompleteOrderTable";

const IncompleteOrderList = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Incomplete Order Information" />
      <div className="space-y-6">
        <ComponentCard title="Incomplete Order List">
          <IncompleteOrderTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default IncompleteOrderList;
