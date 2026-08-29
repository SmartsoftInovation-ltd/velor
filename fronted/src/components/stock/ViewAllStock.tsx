import ComponentCard from "../common/ComponentCard";
import PageBreadcrumb from "../common/PageBreadCrumb";
import PageMeta from "../common/PageMeta";
import ViewAllStockList from "../tables/StockTables/ViewAllStockList";

const ViewAllStock = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="View All Stock" />
      <div className="space-y-6">
        <ComponentCard>
          <ViewAllStockList />
        </ComponentCard>
      </div>
    </>
  );
};

export default ViewAllStock;
