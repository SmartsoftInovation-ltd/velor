import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CreateCustomerTypeForm from "../../components/customer/CreateCustomerTypeForm";

const CreateCustomerType = () => {
  return (
    <>
      <PageMeta
        title="Create Customer Type - Baig Ecommerce"
        description="Add a new customer type"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Customer Type"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/customer-type-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Customer Type List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CreateCustomerTypeForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateCustomerType;
