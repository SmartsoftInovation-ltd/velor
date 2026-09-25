import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import Button from "../ui/button/Button";
import EmployeeAdvancePaymentTable from "../tables/EmployeeTable/EmployeeAdvancePaymentTable";

const EmployeeAdvancePaymentList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("advance-payment", "add");
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Employee Advance Payment List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/create-employee-advance-payment">
                <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
                  Create Employee Advance Payment
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <EmployeeAdvancePaymentTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default EmployeeAdvancePaymentList;
