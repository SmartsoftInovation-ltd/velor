import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import SmsHistoryPanel from "../../components/smsNotification/SmsHistoryPanel";

const SmsHistory = () => {
  return (
    <>
      <PageMeta
        title="SMS History | Admin Dashboard"
        description="View complete bulk SMS campaign history by recipient type with downloadable reports."
      />
      <PageBreadcrumb pageTitle="SMS History" />
      <div className="space-y-6">
        <ComponentCard title="SMS Campaign History">
          <SmsHistoryPanel />
        </ComponentCard>
      </div>
    </>
  );
};

export default SmsHistory;
