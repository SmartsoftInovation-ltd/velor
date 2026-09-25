import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";
import CreateDepartmentForm from "../../components/employee/CreateDepartmentForm";

const CreateDepartment = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Department"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/department-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Department List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CreateDepartmentForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateDepartment
