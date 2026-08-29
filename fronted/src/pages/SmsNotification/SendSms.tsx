import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import SendSmsForm from "../../components/smsNotification/SendSmsForm";

const SendSms = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Send SMS" />
      <div className="space-y-6">
        <ComponentCard title="Send SMS">
          <SendSmsForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default SendSms;
