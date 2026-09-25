import { Link } from "react-router";
import CreateSubCategoryForm from "../../components/category/CreateSubCategoryForm";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";

const CreateSubCategory = () => {
  return (
    <>
      <PageMeta
        title="Create Subcategory | Baig Digital"
        description="Add a new subcategory to your store"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Subcategory"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/subcategory-list">
            <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
              SubCategory List
            </Button>
          </Link>
        }
      />
      <div className="w-full space-y-6">
        <ComponentCard>
          <CreateSubCategoryForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateSubCategory;
