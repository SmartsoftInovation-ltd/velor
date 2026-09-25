import { Link } from "react-router";
import CreateSizeChartForm from "../../components/sizeChart/CreateSizeChartForm";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../../components/ui/button/Button";

const CreateSizeChart = () => {
  return (
    <>
      <PageMeta
        title="Create Size Chart - Baig Ecommerce"
        description="Create a new size chart for products, categories, or brands"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Size Chart"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/sizechart-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Size Chart List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <CreateSizeChartForm />
        </ComponentCard>
      </div>
    </>
  );
};

export default CreateSizeChart;
