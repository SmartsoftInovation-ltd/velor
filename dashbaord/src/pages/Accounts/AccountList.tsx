import { FaSync } from "react-icons/fa";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import AccountTable from "../../components/tables/AccountTable/AccountTable";
import Button from "../../components/ui/button/Button";

const BackIcon = () => (
  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

const AccountList = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (
    <>
      <PageMeta title="Account List - Baig Ecommerce" description="Manage accounts" />
      {/* Header row is just the trail and the back button — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Account List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Go Back"
            >
              <BackIcon />
            </Button>
            <Button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["accounts"] })
              }
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
              title="Refresh"
            >
              <FaSync className="size-3.5" />
            </Button>
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <AccountTable />
        </ComponentCard>
      </div>
    </>
  );
};

export default AccountList;
