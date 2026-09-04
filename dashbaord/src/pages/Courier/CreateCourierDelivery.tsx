import Button from "../../components/ui/button/Button";
import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
// import Button from "../../components/ui/button/Button";
import CourierTable from "../../components/tables/CourierTable/CourierTable";

const CreateCourierDelivery = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Courier Delivery"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/courier-merchant-list">
            <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
              Courier Merchant List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CourierTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateCourierDelivery;
