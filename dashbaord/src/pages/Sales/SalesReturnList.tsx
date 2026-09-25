import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import SalesReturnTable from "../../components/tables/SalesTable/SalesReturnTable";

const SalesReturnList = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the page action — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Sales Return List"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/sales-return" className="w-full sm:w-auto">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded w-full sm:w-auto">
              Sales Return
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <SalesReturnTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default SalesReturnList;
