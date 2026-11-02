// import { useEffect, useState, useRef } from "react";
// import { useParams, useNavigate } from "react-router"; // <-- import useNavigate
// import axiosSecure from "../../../hooks/useAxiosSecure";
// import moment from "moment";
// import jsPDF from "jspdf";
// import html2canvas from "html2canvas-pro";
// import Button from "../../ui/button/Button";

// const InvoicePreview = () => {
//   const { id } = useParams();
//   const navigate = useNavigate(); // <-- initialize navigate
//   const [order, setOrder] = useState<any>(null);
//   const printRef = useRef<HTMLDivElement>(null);

//   useEffect(() => {
//     const fetchOrder = async () => {
//       try {
//         const { data } = await axiosSecure.get(`/order/single-order/${id}`);
//         setOrder(data.data);
//       } catch (error) {
//         console.error("Failed to fetch order:", error);
//       }
//     };
//     if (id) fetchOrder();
//   }, [id]);

//   if (!order) return <p className="text-center mt-10">Loading invoice...</p>;

//   const handleDownload = async () => {
//     if (!printRef.current) return;

//     const canvas = await html2canvas(printRef.current, { scale: 2 });
//     const imgData = canvas.toDataURL("image/png");
//     const pdf = new jsPDF("p", "mm", "a4");
//     const pdfWidth = pdf.internal.pageSize.getWidth();
//     const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
//     pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
//     pdf.save(`invoice-${order.invoiceId || "0000"}.pdf`);
//   };

//   return (
//     <div className="max-w-5xl mx-auto bg-white shadow p-6 rounded mt-8">
//       <div className="mb-6 flex justify-center gap-4 print:hidden">
//         <Button
//           onClick={() => navigate(-1)} // <-- go back to previous page
//           className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
//         >
//           ← Go Back
//         </Button>

//         <Button
//           onClick={() => window.print()}
//           className="bg-accent-500 hover:bg-accent-600 text-white rounded"
//         >
//           🖨️ Print
//         </Button>

//         <Button
//           onClick={handleDownload}
// className="bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] rounded"
//         >
//           💾 Download
//         </Button>
//       </div>
//       <div ref={printRef}>
//         {/* Header */}
//         <div className="text-center mb-4">
//           <h1 className="text-xl font-bold uppercase">Baig Digital</h1>
//           <p className="text-sm">Fixed Price</p>
//           <p className="text-sm">Shop #1, Mirpur 10</p>
//           <p className="text-sm">013500000</p>
//           <hr className="my-2" />
//         </div>

//         {/* Invoice Info */}
//         <div className="grid grid-cols-2 text-sm mb-4 gap-y-1">
//           <p>
//             <strong>Invoice#:</strong> {order.invoiceId || "N/A"}
//           </p>
//           <p>
//             <strong>Date:</strong>{" "}
//             {moment(order.createdAt).format("YYYY-MM-DD")}
//           </p>
//           <p>
//             <strong>Name:</strong> {order.shippingInfo?.name || "N/A"}
//           </p>
//           <p>
//             <strong>Time:</strong> {moment(order.createdAt).format("HH:mm")}
//           </p>
//           <p>
//             <strong>Mobile:</strong> {order.shippingInfo?.phone || "N/A"}
//           </p>
//           <p>
//             <strong>Cashier:</strong> Baig's Collection
//           </p>
//         </div>

//         {/* Products Table */}
//         <table className="w-full text-sm mt-4 border border-gray-300 border-collapse">
//           <thead>
//             <tr className="bg-gray-100">
//               <th className="px-2 py-1 text-left border">ITEM</th>
//               <th className="px-2 py-1 text-center border">COLOR</th>
//               <th className="px-2 py-1 text-center border">SIZE</th>
//               <th className="px-2 py-1 text-center border">QTY.</th>
//               <th className="px-2 py-1 text-right border">PRICE</th>
//               <th className="px-2 py-1 text-right border">DISCOUNT</th>
//               <th className="px-2 py-1 text-right border">AMOUNT</th>
//             </tr>
//           </thead>
//           <tbody>
//             {order.items?.map((item: any, i: number) => (
//               <tr key={i} className="border-b border-gray-200">
//                 <td className="px-2 py-1 text-left">
//                   {item.product?.name} {item.variant?.variantName || ""}
//                 </td>
//                 <td className="px-2 py-1 text-center">{item.color || "N/A"}</td>
//                 <td className="px-2 py-1 text-center">{item.size || "N/A"}</td>
//                 <td className="px-2 py-1 text-center">{item.quantity}</td>
//                 <td className="px-2 py-1 text-right">{item.retailPrice}</td>
//                 <td className="px-2 py-1 text-right">
//                   {item.discountAmount || "N/A"}
//                 </td>
//                 <td className="px-2 py-1 text-right">{item.totalPrice}</td>
//               </tr>
//             ))}
//           </tbody>
//         </table>

//         {/* Totals */}
//         <div className="mt-4 text-sm space-y-1 text-right pr-2">
//           <p>
//             <strong>Total:</strong> ৳{order.totalAmount}
//           </p>
//           <p>
//             <strong>Delivery:</strong> ৳
//             {order.deliveryCharge?.deliveryCharge || 0}
//           </p>
//           <p className="font-bold text-lg border-t pt-2">
//             Payable: ৳{order.finalAmount}
//           </p>
//         </div>
//       </div>

//       {/* Buttons */}
//     </div>
//   );
// };

// export default InvoicePreview;

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import axiosSecure from "../../../hooks/useAxiosSecure";
import moment from "moment";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import Button from "../../ui/button/Button";

const InvoicePreview = () => {
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

  if (!order) return <p className="text-center mt-10">Loading invoice...</p>;

  const handleDownload = async () => {
    if (!printRef.current) return;

    const canvas = await html2canvas(printRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`invoice-${order.invoiceId || "0000"}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          
          body {
            margin: 0;
            padding: 10mm;
          }
          
          /* Hide everything except the invoice */
          body * {
            visibility: hidden;
          }
          
          #printable-invoice,
          #printable-invoice * {
            visibility: visible;
          }
          
          #printable-invoice {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      <div className="max-w-5xl mx-auto bg-white shadow p-6 rounded mt-8">
        <div className="mb-6 flex justify-center gap-4 print:hidden">
          <Button
            onClick={() => navigate(-1)}
            className="px-4 py-2 !rounded !border !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 font-semibold text-sm"
          >
            ← Go Back
          </Button>

          <Button
            onClick={handlePrint}
            className="px-4 py-2 !rounded !bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm"
          >
            Print
          </Button>

          <Button
            onClick={handleDownload}
            className="px-4 py-2 !rounded !border !border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400 font-semibold text-sm"
          >
            Download
          </Button>
        </div>

        <div className="px-5 pt-10" ref={printRef} id="printable-invoice">
          {/* Header */}
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold uppercase">Baig Digital</h1>
            <p className="text-sm">Fixed Price</p>
            <p className="text-sm">Shop #1, Mirpur 10</p>
            <p className="text-sm">013500000</p>
            <hr className="my-2" />
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-2 text-sm mb-4 gap-y-1">
            <p>
              <strong>Invoice#:</strong> {order.invoiceId || "N/A"}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              {moment(order.createdAt).format("YYYY-MM-DD")}
            </p>
            <p>
              <strong>Name:</strong> {order.shippingInfo?.name || "N/A"}
            </p>
            <p>
              <strong>Time:</strong> {moment(order.createdAt).format("HH:mm")}
            </p>
            <p>
              <strong>Mobile:</strong> {order.shippingInfo?.phone || "N/A"}
            </p>
            <p>
              <strong>Cashier:</strong> Baig's Collection
            </p>
          </div>

          {/* Products Table */}
          <table className="w-full text-sm mt-4 border border-gray-300 border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-1 text-left border">ITEM</th>
                <th className="px-2 py-1 text-center border">COLOR</th>
                <th className="px-2 py-1 text-center border">SIZE</th>
                <th className="px-2 py-1 text-center border">QTY.</th>
                <th className="px-2 py-1 text-right border">PRICE</th>
                <th className="px-2 py-1 text-right border">DISCOUNT</th>
                <th className="px-2 py-1 text-right border">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item: any, i: number) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="px-2 py-1 text-left">
                    {item.product?.name} {item.variant?.variantName || ""}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {item.color || "N/A"}
                  </td>
                  <td className="px-2 py-1 text-center">
                    {item.size || "N/A"}
                  </td>
                  <td className="px-2 py-1 text-center">{item.quantity}</td>
                  <td className="px-2 py-1 text-right">{item.retailPrice}</td>
                  <td className="px-2 py-1 text-right">
                    {item.discountAmount || "N/A"}
                  </td>
                  <td className="px-2 py-1 text-right">{item.totalPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 text-sm space-y-1 text-right pr-2">
            <p>
              <strong>Total:</strong> ৳{order.totalAmount}
            </p>
            <p>
              <strong>Delivery:</strong> ৳
              {order.deliveryCharge?.deliveryCharge || 0}
            </p>
            <p className="font-bold text-lg border-t pt-2">
              Payable: ৳{order.finalAmount}
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default InvoicePreview;
