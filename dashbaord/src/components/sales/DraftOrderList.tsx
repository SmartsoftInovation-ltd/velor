import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import SalesHistoryTable from "../tables/SalesTable/SalesHistoryTable";

// Draft order list — same table as the sales history, opening on drafts. The
// fetch also brings back the other statuses (?invoiceStatus=draft,pending,complete)
// so switching the invoice filter works without another request.
const DraftOrderList = () => {
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
        pageTitle="Draft Order List"
        className="mb-3"
        hideTitle
        actions={
          canAdd && (
            <Link to="/create-retail-sales" className="w-full sm:w-auto">
              <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded w-full sm:w-auto">
                Create Retail Sales
              </Button>
            </Link>
          )
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <SalesHistoryTable
            invoiceStatus="draft,pending,complete"
            defaultInvoiceStatus="draft"
          />
        </ComponentCard>
      </div>
    </>
  );
};

export default DraftOrderList;
