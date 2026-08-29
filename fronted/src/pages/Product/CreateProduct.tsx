import { Link } from "react-router";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import CreateProductForm from "../../components/product/CreateProductForm";
import Button from "../../components/ui/button/Button";

const CreateProduct = () => {
  return (
    <>
      <PageMeta
        title="Create Product | Z-Ecommerce Admin"
        description="Add a new product to your inventory with detailed variant and SEO options."
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Product"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/product-list">
            <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
              Product List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CreateProductForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateProduct;
