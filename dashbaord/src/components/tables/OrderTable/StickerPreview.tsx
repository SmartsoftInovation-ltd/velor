import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import axiosSecure from "../../../hooks/useAxiosSecure";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { renderBarcodeToSvg } from "../../../utils/barcodeRender";

const StickerPreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data } = await axiosSecure.get(`/order/single-order/${id}`);
        setOrder(data.data);
      } catch (error) {
        console.error("Failed to fetch order:", error);
      }
    };
    if (id) fetchOrder();
  }, [id]);

  // Drawn in the browser with JsBarcode. It used to be an <img> pointing at
  // barcode.tec-it.com, which sent every order's invoice id to a third party.
  useEffect(() => {
    if (order?.invoiceId && barcodeRef.current) {
      renderBarcodeToSvg(barcodeRef.current, String(order.invoiceId), { height: 48, displayValue: true });
    }
  }, [order]);

  const handleDownload = async () => {
    // Guard against a second click while the first request is still running.
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      if (!printRef.current) return;
      const canvas = await html2canvas(printRef.current, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`sticker-${order.invoiceId || "0000"}.pdf`);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!order) return <p className="text-center mt-10">Loading sticker...</p>;

  return (
    <div className="flex flex-col items-center mt-8">
      {/* Sticker Box */}
      <div
        ref={printRef}
        className="w-[380px] rounded-lg border-2 border-gray-300 p-4 shadow-md"
      >
        {/* Title */}
        <h1 className="text-center font-bold text-xl uppercase">
          Baig's Digital
        </h1>

        <div className="flex justify-center mt-2">
          <svg ref={barcodeRef} role="img" aria-label={`Barcode ${order.invoiceId ?? ""}`} className="h-16" />
        </div>
        {/* Customer Info */}
        <div className="text-sm leading-5 mb-2">
          <p>
            <strong>Customer Name:</strong> {order.shippingInfo?.fullName}
          </p>
          <p>
            <strong>Mobile:</strong> {order.shippingInfo?.phone}
          </p>
          <p>
            <strong>Thana:</strong> {order.shippingInfo?.thana || "N/A"}
          </p>
          <p>
            <strong>District:</strong> {order.shippingInfo?.district || "N/A"}
          </p>
          <p>
            <strong>Address:</strong> {order.shippingInfo?.address}
          </p>
        </div>

        {/* Totals */}
        <div className="flex justify-between text-sm font-semibold mt-2">
          <span>Total Amount: ৳{order.finalAmount}</span>
          <span>Items Qty: {order.items?.length}</span>
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center mt-3">
          {/* <QRCode value={`https://yourwebsite.com/order/${order._id}`} size={90} /> */}
          {/* <p className="text-xs mt-1">Scan here visit website</p> */}
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex gap-3 print:hidden">
        <button
          onClick={() => navigate(-1)}
          type="button"
          className="shine inline-flex items-center gap-2 rounded border border-accent-100 bg-accent-50 px-4 py-2 text-sm font-semibold text-accent-600 hover:bg-accent-100 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
        >
          ← Go Back
        </button>
        <button
          onClick={() => window.print()}
          type="button"
          className="shine rounded bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600"
        >
          Print
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          type="button"
          className="shine inline-flex items-center gap-2 rounded border border-accent-100 bg-accent-50 px-4 py-2 text-sm font-semibold text-accent-600 hover:bg-accent-100 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 disabled:opacity-60"
        >
          {isDownloading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-accent-600/30 border-t-accent-600" />
              Downloading...
            </span>
          ) : (
            "Download"
          )}
        </button>
      </div>
    </div>
  );
};

export default StickerPreview;
