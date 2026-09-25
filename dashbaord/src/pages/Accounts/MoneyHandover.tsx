import { useNavigate, Link } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import MoneyHandoverForm from "../../components/account/MoneyHandoverForm";

const BackIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const MoneyHandover = () => {
  const navigate = useNavigate();
  return (
    <>
      <PageMeta title="Create Money Handover - Baig Ecommerce" description="Add a money handover" />
      {/* Header row is just the trail and the page actions — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Money Handover"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Go Back"
              aria-label="Go Back"
            >
              <BackIcon />
            </Button>
            <Link to="/money-handover-list">
              <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                Handover List
              </Button>
            </Link>
          </div>
        }
      />
      <MoneyHandoverForm />
    </>
  );
};

export default MoneyHandover;
