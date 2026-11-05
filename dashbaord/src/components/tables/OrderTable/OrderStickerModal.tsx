import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { FaDownload, FaPrint } from "react-icons/fa";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { getApiErrorMessage, showApiError } from "../../../utils/apiError";
import { renderBarcodeToSvg } from "../../../utils/barcodeRender";
import { useStoreInfo } from "../../print/printUtils";
import { Modal } from "../../ui/modal";

const STICKER_WIDTH_MM = 100;
const STICKER_HEIGHT_MM = 150;

type Payment = { finalAmount?: number; paymentMethod?: string; paymentStatus?: string };

// What the rider has to take from the customer
export const collection = ({ finalAmount = 0, paymentMethod, paymentStatus }: Payment) => {
  if (paymentStatus === "success") {
    return { label: paymentMethod === "sslcommerz" ? "Paid online" : "Paid", amount: 0 };
  }
  return paymentMethod === "cod"
    ? { label: "Collect on delivery", amount: finalAmount }
    : { label: "Payment pending", amount: finalAmount };
};

const takaWhole = (n: number) => `৳${Number(n || 0).toLocaleString("en-IN")}`;

// A sheet of its own, so nothing else on the page goes to the printer. The page's
// stylesheets are copied over, and the sticker fills the label.
const printSticker = (sticker: HTMLElement) => {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px";
  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((node) => node.outerHTML).join("");
  frame.onload = () => {
    const printer = frame.contentWindow;
    if (!printer) return;
    printer.addEventListener("afterprint", () => frame.remove());
    printer.focus();
    printer.print();
  };
  frame.srcdoc = `<!doctype html><html><head>${styles}<style>@page{size:${STICKER_WIDTH_MM}mm ${STICKER_HEIGHT_MM}mm;margin:0}body{margin:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${sticker.outerHTML}</body></html>`;
  document.body.appendChild(frame);
};

const OrderStickerModal = ({ orderId, onClose }: { orderId: string | null; onClose: () => void }) => {
  const stickerRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { data: store } = useStoreInfo();
  const { data: order, isLoading, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: async () => (await axiosSecure.get(`/order/single-order/${orderId}`)).data.data,
    enabled: Boolean(orderId),
  });

  // Drawn in the browser, so no invoice id ever goes to a third party
  useEffect(() => {
    if (order?.invoiceId && barcodeRef.current) {
      renderBarcodeToSvg(barcodeRef.current, String(order.invoiceId), { height: 56, displayValue: true });
    }
  }, [order]);

  const download = async () => {
    if (isDownloading || !stickerRef.current) return;
    setIsDownloading(true);
    try {
      const [{ default: html2canvas }, { default: JsPdf }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
      const canvas = await html2canvas(stickerRef.current, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
      const height = (canvas.height * STICKER_WIDTH_MM) / canvas.width;
      const pdf = new JsPdf({ unit: "mm", format: [STICKER_WIDTH_MM, height] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, STICKER_WIDTH_MM, height);
      pdf.save(`sticker-${order?.invoiceId || orderId}.pdf`);
    } catch (downloadError) {
      showApiError(downloadError, "Could not make the sticker PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const shipping = order?.shippingInfo ?? {};
  const address = [shipping.address, shipping.city, shipping.postalCode].filter(Boolean).join(", ");
  const units = (order?.items ?? []).reduce((total: number, item: { quantity?: number }) => total + (item.quantity ?? 0), 0);
  const money = order ? collection(order) : null;

  return (
    <Modal isOpen={Boolean(orderId)} onClose={onClose} className="max-h-[92vh] w-full max-w-[30rem] overflow-y-auto">
      <div className="border-b border-gray-100 px-6 py-4 pr-14 dark:border-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Parcel sticker</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Check the details, then print or download.</p>
      </div>

      <div className="flex justify-center overflow-x-auto bg-gray-50 p-5 dark:bg-white/[0.03]">
        {isLoading ? (
          <div className="h-96 w-full max-w-[378px] animate-pulse rounded-lg bg-gray-200 dark:bg-white/5" aria-busy="true" />
        ) : !order ? (
          <p className="py-16 text-center text-sm font-medium text-error-500">
            {getApiErrorMessage(error, "Could not load this order")}
          </p>
        ) : (
          // Stays white in the dark theme: this is what comes out of the printer
          <div ref={stickerRef} style={{ width: `${STICKER_WIDTH_MM}mm` }} className="shrink-0 bg-white text-gray-900 ring-1 ring-gray-300">
            <div className="flex items-center gap-3 border-b-2 border-gray-900 p-4">
              {store?.image?.url && (
                <img src={store.image.url} alt="" crossOrigin="anonymous" className="size-11 shrink-0 object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-bold leading-tight">{store?.storeName || "Your store"}</p>
                {store?.phone && <p className="mt-0.5 text-xs font-medium">{store.phone}</p>}
                {store?.adress && <p className="text-[11px] leading-snug text-gray-600">{store.adress}</p>}
              </div>
            </div>

            <div className="border-b border-gray-300 px-4 py-3 text-center">
              {order.invoiceId ? (
                <svg ref={barcodeRef} role="img" aria-label={`Barcode ${order.invoiceId}`} className="mx-auto h-20 max-w-full" />
              ) : (
                <p className="py-4 text-xs text-gray-500">No invoice number</p>
              )}
            </div>

            <div className="border-b border-gray-300 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Deliver to</p>
              <p className="mt-1 text-lg font-bold leading-snug">{shipping.fullName || "Customer"}</p>
              {shipping.phone && <p className="text-sm font-semibold">{shipping.phone}</p>}
              {address && <p className="mt-1 text-[13px] leading-snug">{address}</p>}
              {shipping.note && (
                <div className="mt-2 border-l-2 border-gray-900 pl-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Note</p>
                  <p className="text-xs leading-snug">{shipping.note}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 divide-x divide-gray-300 border-b border-gray-300 text-center">
              <div className="px-2 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Date</p>
                <p className="text-xs font-semibold">{moment(order.createdAt).format("DD MMM YYYY")}</p>
              </div>
              <div className="px-2 py-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">Items</p>
                <p className="text-xs font-semibold">{units}</p>
              </div>
            </div>

            {money && (
              <div className="flex items-center justify-between gap-3 bg-gray-900 px-4 py-3 text-white">
                <p className="text-xs font-bold uppercase tracking-wide">{money.label}</p>
                <p className="text-xl font-bold tabular-nums">{takaWhole(money.amount)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
        <button
          type="button"
          disabled={!order || isDownloading}
          onClick={download}
          className="shine inline-flex h-10 items-center gap-2 rounded border border-accent-100 bg-accent-50 px-4 text-sm font-semibold text-accent-600 transition hover:bg-accent-100 disabled:opacity-50 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
        >
          <FaDownload className="size-3.5" /> {isDownloading ? "Downloading…" : "Download"}
        </button>
        <button
          type="button"
          disabled={!order}
          onClick={() => stickerRef.current && printSticker(stickerRef.current)}
          className="shine inline-flex h-10 items-center gap-2 rounded bg-accent-500 px-4 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:opacity-50"
        >
          <FaPrint className="size-3.5" /> Print
        </button>
      </div>
    </Modal>
  );
};

export default OrderStickerModal;
