import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft, FaSync } from "react-icons/fa";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import DueSmsTable from "../../components/smsNotification/DueSmsTable";
import Button from "../../components/ui/button/Button";

const DueSms = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <>
      <PageMeta
        title="Due SMS - Baig Ecommerce Admin"
        description="Send SMS to customers with dues"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Customer Due SMS"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["due-sms-customers"] })
              }
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <DueSmsTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default DueSms;
