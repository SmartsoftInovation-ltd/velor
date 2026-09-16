import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { FaArrowLeft } from "react-icons/fa";
import { usePermission } from "../../hooks/usePermission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Button from "../ui/button/Button";
import SupplierTable from "../tables/SupplierTable/SupplierTable";
import axiosSecure from "../../hooks/useAxiosSecure";

export interface Supplier {
  _id: string;
  supplierSerialId?: string;
  supplierId: string;
  supplierName: string;
  contactPersonName: string;
  contactPersonDesignation: string;
  mobile: string;
  supplierAddress: string;
  openingDues: number;
  initialDue?: number;
  totalPurchaseDue: number;
  isActive: boolean;
}

const SupplierList = () => {
  const canAdd = usePermission("supplier", "add");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch full list once — search is filtered client-side
  const {
    data: allSuppliers,
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/supplier/getsuppliers");
        return data.data || [];
      } catch (err: any) {
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Client-side filter on name, mobile, supplierId
  const suppliers = searchTerm.trim()
    ? (allSuppliers ?? []).filter((s) => {
        const q = searchTerm.toLowerCase();
        return (
          s.supplierName?.toLowerCase().includes(q) ||
          s.mobile?.toLowerCase().includes(q) ||
          s.supplierId?.toLowerCase().includes(q) ||
          s.supplierSerialId?.toLowerCase().includes(q) ||
          s.contactPersonName?.toLowerCase().includes(q)
        );
      })
    : (allSuppliers ?? []);

  const fetchSuppliers = () => {
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    refetch();
  };

  return (
    <>
      <PageMeta
        title="Supplier List - Baig Ecommerce"
        description="Manage suppliers in Baig Digital admin dashboard"
      />
      {/* Header row is just the trail and the page actions — the card carries no
          heading of its own. */}
      <PageBreadcrumb
        pageTitle="Supplier List"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className="size-9 p-0 rounded-md !bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] transition-all active:scale-90"
              title="Go Back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            {canAdd && (
              <Link to="/create-supplier">
                <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                  Create Supplier
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
              <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
            </div>
          ) : isError ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-bold mb-4">
                Failed to load suppliers!
              </p>
              <button
                onClick={() => refetch()}
                className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold"
              >
                Try Again
              </button>
            </div>
          ) : (
            <SupplierTable
              suppliers={suppliers}
              fetchSuppliers={fetchSuppliers}
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

export default SupplierList;
