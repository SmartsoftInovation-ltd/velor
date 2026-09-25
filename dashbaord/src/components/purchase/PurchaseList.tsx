import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";

import PurchaseTable from "../tables/PurchaseTable/PurchaseTable";
import Button from "../ui/button/Button";
import { usePermission } from "../../hooks/usePermission";

const PurchaseList = () => {
  const canAdd = usePermission("purchase", "add");

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the page action — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Purchase List"
        className="mb-3"
        hideTitle
        actions={
          canAdd && (
            <Link to="/add-purchase">
              <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
                Add Purchase
              </Button>
            </Link>
          )
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <PurchaseTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default PurchaseList;
