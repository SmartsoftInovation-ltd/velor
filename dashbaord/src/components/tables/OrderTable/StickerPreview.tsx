import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import axiosSecure from "../../../hooks/useAxiosSecure";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
// import QRCode from "qrcode.react";

const StickerPreview = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

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
  console.log(order);

  const handleDownload = async () => {
    if (!printRef.current) return;
    const canvas = await html2canvas(printRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`sticker-${order.invoiceId || "0000"}.pdf`);
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

        {/* Barcode Dummy */}
        <div className="flex justify-center mt-2">
          <img
            src={`https://barcode.tec-it.com/barcode.ashx?data=${order.invoiceId}&code=Code128&dpi=96`}
            alt="barcode"
            className="h-16"
          />
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
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
        >
          ← Go Back
        </button>
        <button
          onClick={() => window.print()}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          🖨️ Print
        </button>
        <button
          onClick={handleDownload}
            className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-4 py-2 rounded"
        >
          💾 Download
        </button>
      </div>
    </div>
  );
};

export default StickerPreview;
