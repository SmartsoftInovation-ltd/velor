import { useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import SmsInformation from "../../components/smsNotification/SmsInformation";
import Button from "../../components/ui/button/Button";

const SmsInfo = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the back button — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="SMS Info"
        className="mb-3"
        hideTitle
        actions={
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            variant="outline"
            className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
            title="Go Back"
          >
            <FaArrowLeft className="size-3.5" />
          </Button>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <SmsInformation />
        </ComponentCard>
      </div>
    </>
  );
};

export default SmsInfo;
