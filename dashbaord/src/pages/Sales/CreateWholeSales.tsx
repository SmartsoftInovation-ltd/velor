import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CreateWholeSalesForm from "../../components/sales/CreateWholeSalesForm";

const CreateWholeSales = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the page heading is
          dropped so the form gets that vertical space. */}
      <PageBreadcrumb
        pageTitle="Create Whole Sales"
        className="hidden sm:flex mb-3"
        hideTitle
        actions={
          <Link to="/sales-history" className="w-full sm:w-auto">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold px-4 py-2 rounded w-full sm:w-auto">
              Sales History List
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
          <CreateWholeSalesForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateWholeSales;
