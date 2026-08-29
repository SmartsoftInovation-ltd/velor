import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { IoIosPrint, IoIosArrowBack } from "react-icons/io";
import axiosSecure from "../../hooks/useAxiosSecure";
import Button from "../ui/button/Button";
import type { Supplier } from "./SupplierList";

interface StoreInformation {
  storeName: string;
  propiterSlogan?: string;
  adress: string;
  phone: string;
  email?: string;
  footer?: string;
  image?: { url?: string };
}

const SupplierProfilePrint = () => {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  const { data: supplier, isLoading, isError } = useQuery<Supplier>({
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

  const { data: storeInfo } = useQuery<StoreInformation | null>({
    queryKey: ["store-information"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/storeinformation/store-information");
        return data.data.stores?.[0] || null;
      } catch {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading)
    return (
      <div className="flex justify-center min-h-100 items-center">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );

  if (isError || !supplier)
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-center">
        <p className="text-red-500 font-bold text-lg mb-4">Failed to load supplier!</p>
        <Button onClick={() => navigate(-1)} className="px-6 py-2 bg-brand-500 text-white rounded-xl">
          Go Back
        </Button>
      </div>
    );

  const due = supplier.totalPurchaseDue ?? supplier.openingDues ?? 0;
  const hasDue = due > 0;

  return (
    <div
      id="print-page-wrap"
      className="min-h-screen bg-gray-100 dark:bg-gray-950 py-6 print:bg-gray-100 print:py-0"
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          #print-page-wrap {
            min-height: 0 !important;
            height: auto !important;
          }
          body * { visibility: hidden; }
          #printable-supplier, #printable-supplier * {
            visibility: visible;
          }
          #printable-supplier {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            font-size: 10px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="px-6">
        {/* Toolbar — hidden on print */}
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-semibold text-sm"
          >
            <IoIosArrowBack className="size-4" />
            Back
          </Button>
          <Button
            onClick={() => window.print()}
            size="sm"
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg"
          >
            <IoIosPrint className="size-4" />
            Print Supplier
          </Button>
        </div>

        {/* Supplier card */}
        <div
          id="printable-supplier"
          className="w-full bg-white dark:bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-8 py-6 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              {storeInfo?.image?.url && (
                <img
                  src={storeInfo.image.url}
                  alt="logo"
                  className="size-14 rounded-xl object-cover border border-gray-200"
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">{storeInfo?.storeName || "Store"}</h1>
                {storeInfo?.propiterSlogan && (
                  <p className="text-xs italic text-gray-500 mt-0.5">{storeInfo.propiterSlogan}</p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">{storeInfo?.adress || ""}</p>
                <p className="text-xs text-gray-500">
                  {storeInfo?.phone ? `Phone: ${storeInfo.phone}` : ""}
                  {storeInfo?.email ? ` | Email: ${storeInfo.email}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-base font-bold text-gray-800 tracking-wide">SUPPLIER PROFILE</h2>
              <p className="text-xs text-gray-500 mt-1">
                Supplier ID: <span className="font-bold text-gray-700">{supplier.supplierId}</span>
              </p>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                  supplier.isActive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                }`}
              >
                {supplier.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="px-8 py-6">
            {/* Supplier / Contact */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Supplier</p>
                <p className="text-sm font-bold text-gray-800">{supplier.supplierName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{supplier.mobile || ""}</p>
                <p className="text-xs text-gray-500 mt-0.5">{supplier.supplierAddress || ""}</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Contact Person</p>
                <p className="text-sm font-bold text-gray-800">{supplier.contactPersonName || "—"}</p>
                {supplier.contactPersonDesignation && (
                  <p className="text-xs text-gray-500 mt-1">
                    <span className="font-semibold">Designation:</span> {supplier.contactPersonDesignation}
                  </p>
                )}
              </div>
            </div>

            {/* Balance Summary */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Balance Summary</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 p-4">
                <div className="px-4 py-4 rounded-xl bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Opening Dues</p>
                  <p className="text-sm font-bold text-gray-800">
                    ৳{(supplier.openingDues || 0).toLocaleString()}
                  </p>
                </div>
                <div className={`px-4 py-4 rounded-xl ${hasDue ? "bg-red-50" : "bg-blue-50"}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${hasDue ? "text-red-500" : "text-blue-500"}`}>
                    Due Balance
                  </p>
                  <p className={`text-sm font-bold ${hasDue ? "text-red-600" : "text-blue-600"}`}>
                    ৳{due.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="flex justify-between mt-16 text-xs text-gray-500">
              <div className="w-2/5 text-center border-t border-gray-300 pt-2">Prepared by</div>
              <div className="w-2/5 text-center border-t border-gray-300 pt-2">Authorized by</div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-400 pb-6 px-8">
            {storeInfo?.footer && <p className="text-gray-500 mb-1">{storeInfo.footer}</p>}
            <p>This is a computer-generated document. No signature required unless specified.</p>
            <p>Generated on {moment().format("MMM DD, YYYY hh:mm A")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierProfilePrint;
