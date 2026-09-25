import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft, FaSync } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../ui/button/Button";
import SupplierPaymentTable, { type SupplierPayment } from "../tables/SupplierTable/SupplierPayementTable";
import axiosSecure from "../../hooks/useAxiosSecure";

const SupplierPaymentList = () => {
  const navigate = useNavigate();
  const canAdd = usePermission("supplier-payment", "add");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: allPayments, isLoading, isFetching, isError, refetch } = useQuery<SupplierPayment[]>({
    queryKey: ["supplier-payments"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/supplier/get-supplier-due-payment");
      return Array.isArray(data.data) ? data.data : [];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Client-side search — by supplier name, mobile, or txn ID
  const payments = searchTerm.trim()
    ? (allPayments ?? []).filter((p) => {
        const q = searchTerm.toLowerCase();
        return (
          p.supplier?.supplierName?.toLowerCase().includes(q) ||
          p.supplier?.mobile?.toLowerCase().includes(q) ||
          p.transactionId?.toLowerCase().includes(q) ||
          p.supplierId?.toLowerCase().includes(q) ||
          p.supplierPaymentSerialId?.toLowerCase().includes(q)
        );
      })
    : (allPayments ?? []);

  const fetchPayments = () => {
    queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="Supplier Payment List - Baig Ecommerce"
        description="View and manage all supplier due payments"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Supplier Payment List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Go Back"
              aria-label="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button
              onClick={fetchPayments}
              disabled={isFetching}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 transition-all active:scale-90"
              title="Refresh Payments"
              aria-label="Refresh Payments"
            >
              <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            {canAdd && (
              <Link to="/create-supplier-payment">
                <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
                  Create Payment
                </Button>
              </Link>
            )}
          </div>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          {isLoading ? (
            <div className="flex justify-center items-center min-h-[400px]">
              <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-bold mb-4">Failed to load payments!</p>
              <button onClick={() => refetch()} className="shine px-6 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-xl font-bold">
                Try Again
              </button>
            </div>
          ) : (
            <SupplierPaymentTable
              payments={payments}
              fetchPayments={fetchPayments}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isFetching={isFetching}
            />
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default SupplierPaymentList;
