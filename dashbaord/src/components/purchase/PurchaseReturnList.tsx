import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link } from "react-router";
import Button from "../ui/button/Button";
import PurchaseReturnTable from "../tables/PurchaseTable/PurchaseReturnTable";

const PurchaseReturnList = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the page action — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Purchase Return List"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/purchase-return">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Purchase Return
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <PurchaseReturnTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default PurchaseReturnList;
