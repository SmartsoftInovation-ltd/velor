import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import SendBlukSmsForm from "../../components/smsNotification/SendBlukSmsForm";

const SendBlukSms = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Send Bulk SMS" />
      <div className="space-y-6">
        <ComponentCard>
          <SendBlukSmsForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default SendBlukSms;
