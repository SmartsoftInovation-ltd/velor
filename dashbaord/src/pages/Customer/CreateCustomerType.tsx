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
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Create Customer Type" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Create Customer Type</h2>
              <Link to="/customer-type-list">
                <Button className="bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded">
                  Customer Type List
                </Button>
              </Link>
            </div>
          }
        >
          <CreateCustomerTypeForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateCustomerType
