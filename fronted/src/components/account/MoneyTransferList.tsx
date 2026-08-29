import { FaSync } from "react-icons/fa";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router";
import { usePermission } from "../../hooks/usePermission";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../ui/button/Button";
import MoneyTransferTable from "../tables/AccountTable/MoneyTransferTable";

const BackIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const MoneyTransferList = () => {
  const queryClient = useQueryClient();
  const canAdd = usePermission("money-transfer", "add");
  const navigate = useNavigate();
  return (
    <>
      <PageMeta title="Money Transfer List - Baig Ecommerce" description="Manage money transfers" />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Money Transfer List"
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
            <Button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["money-transfers"] })
              }
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/add-money-transfer">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                  Add Transfer
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <MoneyTransferTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default MoneyTransferList;
