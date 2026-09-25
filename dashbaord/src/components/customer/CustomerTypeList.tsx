import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import CustomerTypeTable from "../tables/CustomerTable/CustomerTypeTable";

const CustomerTypeList = () => {
  const canAdd = usePermission("customer-type", "add");
  const navigate = useNavigate();
  return (
    <>
      <PageMeta
        title="Customer Type List - Baig Ecommerce"
        description="Manage customer types"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Customer Type List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Go Back"
              aria-label="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/create-customer-type">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Create Customer Type
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CustomerTypeTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default CustomerTypeList;
