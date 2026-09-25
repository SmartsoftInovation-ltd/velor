import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CreateEmployeeAdvancePaymentForm from "../../components/employee/CreateEmployeeAdvancePaymentForm";

const EmployeeAdvancePayment = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Employee Advance Payment"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/employee-advance-payment-list">
            <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
              Employee Advance Payment List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CreateEmployeeAdvancePaymentForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default EmployeeAdvancePayment;
