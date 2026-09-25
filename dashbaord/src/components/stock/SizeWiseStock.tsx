import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Button from "../ui/button/Button";
import PageMeta from "../../components/common/PageMeta";
import SizeWiseStockList from "../tables/StockTables/SizeWiseStockList";
import { useNavigate } from "react-router";
import { FaChevronLeft } from "react-icons/fa";

const SizeWiseStock = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Size Wise Stock - Baig Ecommerce"
        description="Size wise stock report"
      />
      {/* Header row is just the trail and the back button. */}
      <PageBreadcrumb
        pageTitle="Size Wise Stock"
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
      <SizeWiseStockList />
    </>
  );
};

export default SizeWiseStock;
