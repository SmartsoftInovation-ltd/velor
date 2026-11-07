import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import ComponentCard from "../../components/common/ComponentCard";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import CreateRoleForm from "../../components/rolepermission/CreateRoleForm";

const CreateRole = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta title="Create Role - Baig Ecommerce" description="Create a role" />
      {/* Header row is just the trail and the page actions: the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Role"
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
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Link
              to="/role-list"
              className="inline-flex h-9 items-center rounded bg-accent-500 px-4 text-sm font-semibold text-white hover:bg-accent-600"
            >
              Role List
            </Link>
          </div>
        }
      />
      <ComponentCard>
        <CreateRoleForm onCreated={() => navigate("/role-list")} />
      </ComponentCard>
    </>
  );
};

export default CreateRole;
