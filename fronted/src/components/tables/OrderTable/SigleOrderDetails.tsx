import ComponentCard from "../../common/ComponentCard";
import PageBreadcrumb from "../../common/PageBreadCrumb";
import PageMeta from "../../common/PageMeta";

const SigleOrderDetails = () => {
  return (
    <div>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Order Details" />
      <div className="space-y-6">
        <ComponentCard title="Order Details">
          <h2>Order Details Coming Soon...</h2>
          <div className="overflow-y-auto h-[700px] pr-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
            {/* User Information */}
            <div className="mb-6 p-6 border-l-4 border-indigo-500 bg-gray-100 rounded-md shadow-sm ">
              Customer Information
              <p>
                <strong>Name:</strong>
              </p>
            </div>
          </div>
        </ComponentCard>
      </div>
    </div>
  );
};

export default SigleOrderDetails;
