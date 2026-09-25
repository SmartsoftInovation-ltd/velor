import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CreateCouponForm from "../../components/discount/CreateCouponForm";

const CreateCoupon = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Coupon"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/coupon-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Coupon List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CreateCouponForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateCoupon;
