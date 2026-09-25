import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CreateSupplierPaymentForm from "../../components/supplier/CreateSupplierPaymentForm";

const CreateSupplierPayment = () => {
  return (
    <>
      <PageMeta
        title="Create Supplier Payment - Baig Ecommerce"
        description="Record a due payment for a supplier"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Supplier Payment"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/supplier-payment-list">
            <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
              Supplier Payment List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CreateSupplierPaymentForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateSupplierPayment;
