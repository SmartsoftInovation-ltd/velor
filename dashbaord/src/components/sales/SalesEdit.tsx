import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import Button from "../ui/button/Button";
import CreateRetailSalesForm from "./CreateRetailSalesForm";
import CreateWholeSalesForm from "./CreateWholeSalesForm";

// Loads the sale, then hands it to the matching create form in edit mode.
// The forms own all the layout, validation and payload logic — this wrapper
// only fetches and routes wholesale vs. retail.
const SalesEdit = () => {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const navigate = useNavigate();

  const {
    data: sale,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["sale-invoice", invoiceNumber],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/sales/get-sales?invoiceNumber=${encodeURIComponent(invoiceNumber || "")}`,
      );
      const list = data.data || [];
      return Array.isArray(list) ? list[0] : list;
    },
    enabled: !!invoiceNumber,
  });

  if (isLoading)
    return (
      <div className="flex justify-center min-h-100 items-center">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );

  if (isError || !sale)
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-center">
        <p className="text-red-500 font-bold text-lg mb-4">
          Failed to load sale!
        </p>
        <Button
          onClick={() => refetch()}
          className="px-6 py-2 bg-brand-500 text-white rounded-xl"
        >
          Try Again
        </Button>
      </div>
    );

  const isWholesale = sale.salesType === "wholesale";
  const goBack = () => navigate(`/sales-view/${encodeURIComponent(sale.invoiceNumber)}`);

  return (
    <>
      <PageMeta
        title={`Edit Sale ${sale.invoiceNumber} - Baig Ecommerce`}
        description="Edit sale"
      />
      <PageBreadcrumb pageTitle={`Edit Sale — ${sale.invoiceNumber}`} />
      <div className="space-y-6">
        {isWholesale ? (
          <CreateWholeSalesForm editSale={sale} onUpdated={goBack} />
        ) : (
          <CreateRetailSalesForm editSale={sale} onUpdated={goBack} />
        )}
      </div>
    </>
  );
};

export default SalesEdit;
