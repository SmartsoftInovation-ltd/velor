import { useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import AuditLogTable from "../../components/auditlog/AuditLogTable";
import Button from "../../components/ui/button/Button";

const AuditLogList = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Audit Log - Baig Ecommerce"
        description="Track all user actions across the system"
      />
      {/* Header row is just the trail and the back button — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Activity History"
        className="mb-3"
        hideTitle
        actions={
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            variant="outline"
            className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
            title="Go Back"
            aria-label="Go back"
          >
            <FaArrowLeft className="size-3.5" />
          </Button>
        }
      />
      <AuditLogTable />
    </>
  );
};

export default AuditLogList;
