import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CreateSalesReturnForm from "../../components/sales/CreateSalesReturnForm";

const CreateSalesReturn = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the page heading is
          dropped so the form gets that vertical space. */}
      <PageBreadcrumb
        pageTitle="Sales Return"
        className="hidden sm:flex mb-3"
        hideTitle
        actions={
          <Link to="/sales-return-list">
            <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] px-4 py-2 rounded">
              Sales Return List
            </Button>
          </Link>
        }
      />
      <div className="flex h-[calc(100vh-9.6rem)] min-h-[520px] flex-col">
        <ComponentCard
          className="flex flex-1 min-h-0 flex-col"
          bodyClassName="!p-0"
          fillBody
        >
          <CreateSalesReturnForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateSalesReturn;
