import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { IoIosPrint, IoIosArrowBack } from "react-icons/io";
import axiosSecure from "../../hooks/useAxiosSecure";
import Button from "../ui/button/Button";
import type { AdvancePayment } from "../tables/CustomerTable/CustomerAdvancePaymentList";

interface StoreInformation {
  storeName: string;
  propiterSlogan?: string;
  adress: string;
  phone: string;
  email?: string;
  footer?: string;
  image?: { url?: string };
}

const CustomerAdvancePaymentInvoicePrint = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: payment,
    isLoading,
    isError,
  } = useQuery<AdvancePayment>({
    queryKey: ["customer-advance-payment", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        "/customer/get-customer-advance-payment-reviced",
      );
      const list: AdvancePayment[] = data?.data?.customerAdvancePayments || [];
      const found = list.find((p) => p._id === id);
      if (!found) throw new Error("Not found");
      return found;
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

  if (isError || !payment)
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-center">
        <p className="text-red-500 font-bold text-lg mb-4">
          Failed to load payment!
        </p>
        <Button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-brand-500 text-white rounded-xl"
        >
          Go Back
        </Button>
      </div>
    );

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
          #printable-payment, #printable-payment * {
            visibility: visible;
          }
          #printable-payment {
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
            Print Receipt
          </Button>
        </div>

        {/* Payment card */}
        <div
          id="printable-payment"
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
                CUSTOMER ADVANCE PAYMENT RECEIPT
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Payment ID:{" "}
                <span className="font-bold text-gray-700">
                  {payment.paymentId || `CAPR-SI-${payment._id.slice(-4)}`}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Date:{" "}
                <span className="font-bold text-gray-700">
                  {moment(payment.date || payment.createdAt).format(
                    "MMM DD, YYYY",
                  )}
                </span>
              </p>
            </div>
          </div>

          <div className="px-8 py-6 print:py-3">
            {/* Customer / Payment method */}
            <div className="grid grid-cols-2 gap-4 mb-6 print:mb-3">
              <div className="border border-gray-200 rounded-xl p-4 print:p-2 bg-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                  Customer
                </p>
                <p className="text-sm font-bold text-gray-800">
                  {payment.customer?.fullName || "—"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {payment.customer?.customerId || ""}
                </p>
              </div>
              <div className="border border-gray-200 rounded-xl p-4 print:p-2 bg-gray-50">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                  Payment Details
                </p>
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Account:</span>{" "}
                  {payment.paymentMode?.name || "—"}
                </p>
                {payment.remarks && (
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">Remarks:</span>{" "}
                    {payment.remarks}
                  </p>
                )}
              </div>
            </div>

            {/* Payment Summary */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 print:py-1.5 border-b border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">
                  Payment Summary
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 print:p-2 print:gap-2">
                <div className="px-4 py-4 print:py-2 rounded-xl bg-orange-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-orange-500 mb-1">
                    Previous Balance
                  </p>
                  <p className="text-sm font-bold text-orange-700">
                    ৳
                    {(
                      (payment.balance ?? 0) - (payment.paidAmount ?? 0)
                    ).toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-4 print:py-2 rounded-xl bg-green-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 mb-1">
                    Paid
                  </p>
                  <p className="text-sm font-bold text-green-700">
                    ৳{(payment.paidAmount ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-4 print:py-2 rounded-xl bg-gray-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                    Cashback
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    ৳{(payment.advanceCashBack ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="px-4 py-4 print:py-2 rounded-xl bg-purple-50">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-purple-500 mb-1">
                    Balance
                  </p>
                  <p className="text-sm font-bold text-purple-700">
                    ৳{(payment.balance ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="flex justify-between mt-16 print:mt-8 text-xs text-gray-500">
              <div className="w-2/5 text-center border-t border-gray-300 pt-2">
                Received by
              </div>
              <div className="w-2/5 text-center border-t border-gray-300 pt-2">
                Authorized by
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

export default CustomerAdvancePaymentInvoicePrint;
