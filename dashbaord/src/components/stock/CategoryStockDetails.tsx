import { useNavigate } from "react-router";
import { FaChevronLeft } from "react-icons/fa";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import CategoryStockDetailList from "../tables/StockTables/CategoryStockDetailList";
import Button from "../ui/button/Button";

const CategoryStockDetails = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the back button — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Category Stock Details"
        className="mb-3"
        hideTitle
        actions={
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            variant="outline"
            className="size-9 p-0 rounded-md !bg-[#D5F0E3] hover:!bg-[#B8E4CF] !text-[#0A6B43] transition-all active:scale-90"
            title="Go Back"
          >
            <FaChevronLeft className="size-3.5" />
          </Button>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CategoryStockDetailList />
        </ComponentCard>
      </div>
    </>
  );
};

export default CategoryStockDetails;
