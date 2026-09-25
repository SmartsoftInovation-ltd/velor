import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CreateRetailSaleOrderForm from "../../components/sales/CreateRetailSaleOrderForm";

const CreateRetailSaleOrder = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the page heading is
          dropped so the form gets that vertical space. */}
      <PageBreadcrumb
        pageTitle="Create Retail Sale Order"
        className="hidden sm:flex mb-3"
        hideTitle
        actions={
          <Link to="/sale-order-list" className="w-full sm:w-auto">
            <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] px-4 py-2 rounded w-full sm:w-auto">
              Order List
            </Button>
          </Link>
        }
      />
      <div className="flex h-auto md:h-[calc(100vh-9.6rem)] md:min-h-[520px] flex-col">
        <ComponentCard
          className="flex flex-1 min-h-0 flex-col"
          bodyClassName="!p-0"
          fillBody
        >
          <CreateRetailSaleOrderForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateRetailSaleOrder;
