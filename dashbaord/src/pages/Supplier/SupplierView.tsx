import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Button from "../../components/ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";

const SupplierView = () => {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  const {
    data: supplier,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/supplier/getsuppliers?supplierId=${supplierId}`,
      );
      const list = data.data || [];
      return Array.isArray(list) ? list[0] : list;
    },
    enabled: !!supplierId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !supplier) {
    return (
      <>
        <PageMeta title="Supplier Not Found - Baig Ecommerce" description="" />
        <PageBreadcrumb pageTitle="Supplier View" />
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-500 font-semibold text-lg">
            Supplier not found.
          </p>
          <Button
            onClick={() => navigate("/supplier-list")}
            className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded-xl"
          >
            Back to List
          </Button>
        </div>
      </>
    );
  }

  const due = supplier.totalPurchaseDue ?? supplier.openingDues ?? 0;

  return (
    <>
      <PageMeta
        title={`${supplier.supplierName} - Supplier View`}
        description="View supplier details"
      />
      <PageBreadcrumb pageTitle="Supplier View" />

      <div className="space-y-5 max-w-full">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Supplier Details</h2>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    navigate(`/supplier-edit/${supplier.supplierId}`)
                  }
                  className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => navigate("/supplier-list")}
                  className="bg-gray-500 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded"
                >
                  Back
                </Button>
              </div>
            </div>
          }
        >
          {/* Header block */}
          <div className="flex items-start justify-between mb-6 pb-5 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {supplier.supplierName}
              </h3>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
                Supplier ID:{" "}
                <span className="font-mono">{supplier.supplierId || "—"}</span>
              </p>
            </div>
            <span
              className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                supplier.isActive
                  ? "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                  : "bg-red-100 text-red-500 dark:bg-red-500/10 dark:text-red-400"
              }`}
            >
              {supplier.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            <Field label="Mobile" value={supplier.mobile} mono />
            <Field
              label="Due Balance"
              value={`৳${due.toLocaleString()}`}
              highlight={due > 0}
            />
            <Field label="Contact Person" value={supplier.contactPersonName} />
            <Field
              label="Designation"
              value={supplier.contactPersonDesignation}
            />
          </div>

          {/* Address — full width */}
          <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
              Supplier Address
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {supplier.supplierAddress || (
                <span className="text-gray-300 dark:text-gray-600">
                  No address provided
                </span>
              )}
            </p>
          </div>

          {/* Opening dues note */}
          {supplier.openingDues > 0 && (
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                Opening Dues
              </p>
              <p className="text-sm font-semibold text-orange-500">
                ৳{supplier.openingDues.toLocaleString()}
              </p>
            </div>
          )}
        </ComponentCard>
      </div>
    </>
  );
};

const Field = ({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value?: string | number;
  mono?: boolean;
  highlight?: boolean;
}) => (
  <div>
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
      {label}
    </p>
    <p
      className={`text-sm ${mono ? "font-mono" : ""} ${
        highlight
          ? "text-red-500 font-semibold"
          : "text-gray-700 dark:text-gray-200"
      }`}
    >
      {value || <span className="text-gray-300 dark:text-gray-600">—</span>}
    </p>
  </div>
);

export default SupplierView;
