import { Link } from "react-router";
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
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Supplier Payment List
            </Button>
          </Link>
        }
      />
      <CreateSupplierPaymentForm />
    </>
  );
};

export default CreateSupplierPayment;
