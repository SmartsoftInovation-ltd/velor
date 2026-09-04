import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Button from "../ui/button/Button";
import PageMeta from "../../components/common/PageMeta";
import SizeColorWiseStockList from "../tables/StockTables/SizeColorWiseStockList";
import { useNavigate } from "react-router";
import { FaChevronLeft } from "react-icons/fa";

const SizeColorWiseStock = () => {
  const navigate = useNavigate();

  return (
    <>
      <PageMeta
        title="Color Wise Stock - Baig Ecommerce"
        description="Color wise stock report"
      />
      {/* Header row is just the trail and the back button. */}
      <PageBreadcrumb
        pageTitle="Color Wise Stock"
        className="mb-3"
        hideTitle
        actions={
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            variant="outline"
            className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
            title="Go Back"
          >
            <FaChevronLeft className="size-3.5" />
          </Button>
        }
      />
      <SizeColorWiseStockList />
    </>
  );
};

export default SizeColorWiseStock;
