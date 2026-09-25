import { Link } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CustomerPaymentReceiveForm from "../../components/customer/CustomerPaymentReceiveForm";

const CreateCustomerPayementReceive = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Customer Payment Receive"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/customer-payment-receive-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Customer Payment Receive List
            </Button>
          </Link>
        }
      />
      <CustomerPaymentReceiveForm />
    </>
  );
};

export default CreateCustomerPayementReceive;
