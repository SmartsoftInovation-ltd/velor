import { Link } from "react-router";

import AddTransactionCategoryForm from "../../components/account/AddTransactionCategoryForm";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";

const AddTransactionCategory = () => {
  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Transaction Category"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/transaction-category-list">
            <Button className="!bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] font-normal text-sm px-4 py-2 rounded">
              Transaction Category List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <AddTransactionCategoryForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default AddTransactionCategory;
