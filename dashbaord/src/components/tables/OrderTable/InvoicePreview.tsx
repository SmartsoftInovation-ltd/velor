import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { FaArrowLeft, FaDownload, FaPrint } from "react-icons/fa";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { getApiErrorMessage, showApiError } from "../../../utils/apiError";
import { printElement } from "../../../utils/printElement";
import { useStoreInfo } from "../../print/printUtils";
import { collection } from "./OrderStickerModal";

type InvoiceItem = {
  product?: { name?: string } | null;
  variant?: { variantName?: string } | null;
  color?: string;
  size?: string;
  quantity?: number;
  retailPrice?: number;
  totalPrice?: number;
};

const money = (n?: number) => `৳${Number(n || 0).toLocaleString("en-IN")}`;
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-gray-500";
const SOFT_BUTTON =
  "shine inline-flex h-10 items-center gap-2 rounded border border-accent-100 bg-accent-50 px-4 text-sm font-semibold text-accent-600 transition hover:bg-accent-100 disabled:opacity-50 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400";

const InvoicePreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { data: store } = useStoreInfo();
  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => (await axiosSecure.get(`/order/single-order/${id}`)).data.data,
    enabled: Boolean(id),
  });

  const download = async () => {
    if (isDownloading || !sheetRef.current) return;
    setIsDownloading(true);
    try {
      const [{ default: html2canvas }, { default: JsPdf }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const canvas = await html2canvas(sheetRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const pdf = new JsPdf("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, width, (canvas.height * width) / canvas.width);
      pdf.save(`invoice-${order?.invoiceId || id}.pdf`);
    } catch (downloadError) {
      showApiError(downloadError, "Could not make the invoice PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return <div className="mx-auto mt-4 h-[32rem] max-w-3xl animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" aria-busy="true" />;
  }
  if (!order) {
    return <p className="mt-10 text-center text-sm font-medium text-error-500">{getApiErrorMessage(error, "Could not load this invoice")}</p>;
  }

  const shipping = order.shippingInfo ?? {};
  const address = [shipping.address, shipping.city, shipping.postalCode].filter(Boolean).join(", ");
  const payment = collection(order);
  const delivery = order.deliveryCharge?.deliveryCharge ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => navigate(-1)} className={SOFT_BUTTON}>
          <FaArrowLeft className="size-3.5" /> Back
        </button>
        <div className="flex gap-2">
          <button type="button" disabled={isDownloading} onClick={download} className={SOFT_BUTTON}>
            <FaDownload className="size-3.5" /> {isDownloading ? "Downloading…" : "Download"}
          </button>
          <button
            type="button"
            onClick={() => sheetRef.current && printElement(sheetRef.current, "size:A4;margin:12mm")}
            className="shine inline-flex h-10 items-center gap-2 rounded bg-accent-500 px-4 text-sm font-semibold text-white transition hover:bg-accent-600"
          >
            <FaPrint className="size-3.5" /> Print
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Stays white in the dark theme: this is what comes out of the printer */}
        <div ref={sheetRef} className="min-w-[36rem] bg-white p-8 text-gray-900">
          <div className="flex items-start justify-between gap-6 border-b-2 border-gray-900 pb-5">
            <div className="flex min-w-0 items-center gap-3">
              {store?.image?.url && <img src={store.image.url} alt="" crossOrigin="anonymous" className="size-14 shrink-0 object-contain" />}
              <div className="min-w-0">
                <p className="text-xl font-bold leading-tight">{store?.storeName || "Your store"}</p>
                {store?.adress && <p className="mt-0.5 text-xs leading-snug text-gray-600">{store.adress}</p>}
                <p className="text-xs text-gray-600">{[store?.phone, store?.email].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold tracking-tight">INVOICE</p>
              <p className="mt-1 font-mono text-sm font-semibold">{order.invoiceId || "—"}</p>
              <p className="text-xs text-gray-600">{moment(order.createdAt).format("DD MMM YYYY, hh:mm A")}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-6">
            <div>
              <p className={LABEL}>Bill to</p>
              <p className="mt-1 text-sm font-semibold">{shipping.fullName || "Customer"}</p>
              {shipping.phone && <p className="text-sm">{shipping.phone}</p>}
              {address && <p className="text-sm leading-snug text-gray-600">{address}</p>}
            </div>
            <div className="text-right">
              <p className={LABEL}>Payment</p>
              <p className="mt-1 text-sm font-semibold">{payment.label}</p>
            </div>
          </div>

          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-gray-900 text-left">
                <th className={`${LABEL} py-2 pr-3`}>Item</th>
                <th className={`${LABEL} px-3 py-2 text-right`}>Qty</th>
                <th className={`${LABEL} px-3 py-2 text-right`}>Price</th>
                <th className={`${LABEL} py-2 pl-3 text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(order.items ?? []).map((item: InvoiceItem, index: number) => {
                const details = [item.variant?.variantName, item.color, item.size].filter(Boolean).join(" · ");
                return (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{item.product?.name || item.variant?.variantName || "Item"}</p>
                      {details && <p className="text-xs text-gray-500">{details}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{money(item.retailPrice)}</td>
                    <td className="py-2.5 pl-3 text-right font-medium tabular-nums">{money(item.totalPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="ml-auto mt-4 w-64 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span className="tabular-nums">{money(order.totalAmount)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Discount</span>
                <span className="tabular-nums">−{money(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery</span>
              <span className="tabular-nums">{money(delivery)}</span>
            </div>
            <div className="flex items-center justify-between border-t-2 border-gray-900 pt-2 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{money(order.finalAmount)}</span>
            </div>
          </div>

          {store?.footer && <p className="mt-8 border-t border-gray-200 pt-3 text-center text-xs text-gray-500">{store.footer}</p>}
        </div>
      </div>
    </div>
  );
};

export default InvoicePreview;
