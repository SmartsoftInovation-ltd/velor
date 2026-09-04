import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { IoIosPrint, IoIosArrowBack } from "react-icons/io";
import axiosSecure from "../../hooks/useAxiosSecure";
import Button from "../ui/button/Button";

// ---------- Types ----------
interface SupplierRef {
  _id: string;
  supplierName?: string;
  name?: string;
  mobile?: string;
}

interface AccountRef {
  _id: string;
  name?: string;
}

interface PurchaseItemRef {
  _id: string;
  name?: string;
  variantName?: string;
  barCode?: string;
  sku?: string;
}

interface PurchaseItem {
  _id: string;
  product?: PurchaseItemRef | null;
  variant?: (PurchaseItemRef & { product?: PurchaseItemRef | null }) | null;
  purchasePrice: number;
  quantity: number;
  size?: string;
  color?: string;
}

interface Purchase {
  _id: string;
  invoiceNumber: string;
  date: string;
  supplierId: SupplierRef | null;
  cashType: AccountRef | null;
  allproduct: PurchaseItem[];
  subTotal: number;
  commission: number;
  shipping: number;
  payable: number;
  dueamount: number;
  paid: number;
}

interface StoreInformation {
  storeName: string;
  propiterSlogan?: string;
  adress: string;
  phone: string;
  email?: string;
  footer?: string;
  image?: { url?: string };
}

const getItemName = (item: PurchaseItem) =>
  item.variant?.product?.name ||
  item.product?.name ||
  item.variant?.variantName ||
  "—";

const getItemSku = (item: PurchaseItem) =>
  item.variant?.sku || item.variant?.product?.sku || item.product?.sku || "—";

const getItemBarcode = (item: PurchaseItem) =>
  item.variant?.barCode ||
  item.variant?.product?.barCode ||
  item.product?.barCode ||
  "";

const getSupplierName = (supplierId: SupplierRef | null) => {
  if (!supplierId) return "—";
  return supplierId.supplierName || supplierId.name || "—";
};

const PurchaseInvoicePrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: purchase,
    isLoading,
    isError,
  } = useQuery<Purchase>({
    queryKey: ["purchase", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/purchase/single-purchase/${id}`);
      return data.data.purchase;
    },
    enabled: !!id,
  });

  const { data: storeInfo } = useQuery<StoreInformation | null>({
    queryKey: ["store-information"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get(
          "/storeinformation/store-information",
        );
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

  if (isError || !purchase)
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-center">
        <p className="text-red-500 font-bold text-lg mb-4">
          Failed to load purchase!
        </p>
        <Button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-brand-500 text-white rounded-xl"
        >
          Go Back
        </Button>
      </div>
    );

  const isDue = purchase.dueamount > 0;

  return (
    <div
      id="print-root"
      className="min-h-screen bg-gray-100 dark:bg-gray-950 py-6 print:bg-gray-100 print:py-0"
    >
      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          #print-root {
            min-height: 0 !important;
            height: auto !important;
          }
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * {
            visibility: visible;
          }
          #printable-invoice {
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
            Print Invoice
          </Button>
        </div>

        {/* Invoice card */}
        <div
          id="printable-invoice"
          className="w-full bg-white dark:bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none"
        >
          {/* Header */}
          <div className="flex items-start justify-between px-8 py-6 print:py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              {storeInfo?.image?.url && (
                <img
                  src={storeInfo.image.url}
                  alt="logo"
                  className="size-14 rounded-xl object-cover border border-gray-200"
                />
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {storeInfo?.storeName || "Store"}
                </h1>
                {storeInfo?.propiterSlogan && (
                  <p className="text-xs italic text-gray-500 mt-0.5">
                    {storeInfo.propiterSlogan}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                  {storeInfo?.adress || ""}
                </p>
                <p className="text-xs text-gray-500">
                  {storeInfo?.phone ? `Phone: ${storeInfo.phone}` : ""}
                  {storeInfo?.email ? ` | Email: ${storeInfo.email}` : ""}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-base font-bold text-gray-800 tracking-wide">
                PURCHASE INVOICE
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Invoice No:{" "}
                <span className="font-bold text-gray-700">
                  {purchase.invoiceNumber}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Date:{" "}
                <span className="font-bold text-gray-700">
                  {moment(purchase.date).format("MMM DD, YYYY")}
                </span>
              </p>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                  isDue
                    ? "bg-red-100 text-red-600"
                    : "bg-green-100 text-green-600"
                }`}
              >
                {isDue ? "Due" : "Received"}
              </span>
            </div>
          </div>

          <div className="px-8 py-6 print:py-3">
            {/* Supplier / Payment */}
            <div className="grid grid-cols-2 gap-4 mb-6 print:mb-3">
              <div className="border border-gray-200 rounded-xl p-4 print:p-2 bg-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                  Supplier
                </p>
                <p className="text-sm font-bold text-gray-800">
                  {getSupplierName(purchase.supplierId)}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {purchase.supplierId?.mobile || ""}
                </p>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 print:p-2 bg-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                  Payment Details
                </p>
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Method:</span>{" "}
                  {purchase.cashType?.name || "—"}
                </p>
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Paid:</span> ৳
                  {(purchase.paid || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Items table */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-center">
                    #
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-left">
                    Product
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-center">
                    Barcode
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-center">
                    SKU
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-center">
                    Color
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-center">
                    Size
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-center">
                    Qty
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-right">
                    Buy Price
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-wide text-gray-500 px-3 py-2.5 print:py-1 text-right">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {(purchase.allproduct || []).map((item, idx) => {
                  const amount =
                    (item.purchasePrice || 0) * (item.quantity || 0);
                  return (
                    <tr
                      key={item._id}
                      className={idx % 2 === 1 ? "bg-gray-50" : ""}
                    >
                      <td className="px-3 py-2.5 print:py-1 text-center text-xs text-gray-600 border-b border-gray-100">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-xs text-gray-800 border-b border-gray-100">
                        {getItemName(item)}
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-center text-xs font-mono text-gray-600 border-b border-gray-100">
                        {getItemBarcode(item) || "—"}
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-center text-xs font-mono text-gray-600 border-b border-gray-100">
                        {getItemSku(item)}
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-center text-xs text-gray-600 border-b border-gray-100">
                        {item.color && item.color !== "N/A" ? item.color : "—"}
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-center text-xs text-gray-600 border-b border-gray-100">
                        {item.size || "—"}
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-center text-xs text-gray-600 border-b border-gray-100">
                        {item.quantity || 0}
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-right text-xs text-gray-600 border-b border-gray-100">
                        ৳{(item.purchasePrice || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 print:py-1 text-right text-xs font-bold text-gray-800 border-b border-gray-100">
                        ৳{amount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Payment Summary */}
            <div className="mt-6 print:mt-3 border border-gray-200 rounded overflow-hidden">
              <div className="px-4 py-3 print:py-1.5 border-b border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Payment Summary
                </p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 p-4 print:p-2 print:gap-2">
                <div className="px-4 py-4 print:py-2 rounded-md bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                    Subtotal
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    ৳{(purchase.subTotal || 0).toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-4 print:py-2 rounded-md bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                    Commission
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    ৳{(purchase.commission || 0).toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-4 print:py-2 rounded-md bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                    Shipping
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    ৳{(purchase.shipping || 0).toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-4 print:py-2 rounded-md bg-blue-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-500 mb-1">
                    Payable
                  </p>
                  <p className="text-sm font-bold text-blue-600">
                    ৳{(purchase.payable || 0).toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-4 print:py-2 rounded-md bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                    Paid
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    ৳{(purchase.paid || 0).toLocaleString()}
                  </p>
                </div>
                <div
                  className={`px-4 py-4 print:py-2 rounded-md ${isDue ? "bg-red-50" : "bg-green-50"}`}
                >
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${isDue ? "text-red-500" : "text-green-600"}`}
                  >
                    Due
                  </p>
                  <p
                    className={`text-sm font-bold ${isDue ? "text-red-600" : "text-green-600"}`}
                  >
                    ৳{(purchase.dueamount || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="flex justify-between mt-16 print:mt-8 text-xs text-gray-500">
              <div className="w-2/5 text-center border-t border-gray-300 pt-2">
                Prepared by
              </div>
              <div className="w-2/5 text-center border-t border-gray-300 pt-2">
                Approved by
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-[10px] text-gray-400 pb-6 print:pb-2 px-8">
            {storeInfo?.footer && (
              <p className="text-gray-500 mb-1">{storeInfo.footer}</p>
            )}
            <p>
              This is a computer-generated document. No signature required
              unless specified.
            </p>
            <p>Generated on {moment().format("MMM DD, YYYY hh:mm A")}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseInvoicePrint;
