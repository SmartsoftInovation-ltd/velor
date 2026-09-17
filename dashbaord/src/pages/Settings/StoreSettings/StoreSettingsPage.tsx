import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import StoreSettings from "./StoreSettings";

const StoreSettingsPage = () => (
  <>
    <PageMeta title="Store Settings" description="Store profile, integrations and webhook URLs" />
    <PageBreadcrumb pageTitle="Store Settings" className="mb-3" />
    <StoreSettings />
  </>
);

export default StoreSettingsPage;
