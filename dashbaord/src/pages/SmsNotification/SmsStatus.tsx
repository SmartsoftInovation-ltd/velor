import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import SmsStatusPanel from "../../components/smsNotification/SmsStatusPanel";

const SmsStatus = () => {
  return (
    <>
      <PageMeta
        title="SMS Status | Admin Dashboard"
        description="Real-time SMS campaign status with delivery statistics and full campaign tracking."
      />
      <PageBreadcrumb pageTitle="SMS Status" />
      <div className="space-y-6">
        <ComponentCard title="SMS Campaign Status">
          <SmsStatusPanel />
        </ComponentCard>
      </div>
    </>
  );
};

export default SmsStatus;
