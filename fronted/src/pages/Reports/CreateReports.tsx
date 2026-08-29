import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import AllReportList from "../../components/reports/AllReportList";

const CreateReports = () => {
  return (
    <>
      <PageMeta
        title="All Reports - Baig Ecommerce"
        description="Generate and review business reports across every module"
      />
      <PageBreadcrumb pageTitle="All Reports" />
      <AllReportList />
    </>
  );
};

export default CreateReports;
