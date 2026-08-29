import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import SalesHistoryTable from "../tables/SalesTable/SalesHistoryTable";

const SalesHistoryList = () => {
  const canAdd = usePermission("retail-sales", "add");
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the page action — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Sales History List"
        className="mb-3"
        hideTitle
        actions={
          canAdd && (
            <Link to="/create-retail-sales">
              <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-xs sm:text-sm px-2.5 sm:px-4 py-1.5 sm:py-2 rounded whitespace-nowrap">
                <span className="sm:hidden">Create Sales</span>
                <span className="hidden sm:inline">Create Retail Sales</span>
              </Button>
            </Link>
          )
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {/* Sales history covers finished sales only — draft and pending
              invoices live on the draft and order-list pages. */}
          <SalesHistoryTable invoiceStatus="complete" />
        </ComponentCard>
      </div>
    </>
  );
};

export default SalesHistoryList;
