import { useNavigate, Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import AddMoneyTransferForm from "../../components/account/AddMoneyTransferForm";

const BackIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const MoneyTransfer = () => {
  const navigate = useNavigate();
  return (
    <>
      <PageMeta title="Create Money Transfer - Baig Ecommerce" description="Add a money transfer" />
      {/* Header row is just the trail and the page actions — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Money Transfer"
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
              <BackIcon />
            </Button>
            <Link to="/money-transfer-list">
              <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                Transfer List
              </Button>
            </Link>
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <AddMoneyTransferForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default MoneyTransfer;
