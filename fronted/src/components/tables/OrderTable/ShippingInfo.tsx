import { useState } from "react";
import { Modal } from "../../ui/modal";
import Button from "../../ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";

const ShippingInfo = ({ order }: { order: any }) => {
  const [showModal, setShowModal] = useState(false);

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  // courier data (dummy for now)
  const courierStats = [
    {
      courier: "Steadfast New",
      total: 7,
      delivered: 7,
      returned: 0,
      ratio: 100,
    },
    { courier: "RedX", total: 25, delivered: 21, returned: 4, ratio: 84 },
    { courier: "Pathao", total: 30, delivered: 26, returned: 4, ratio: 87 },
  ];

  const totalParcels = courierStats.reduce((acc, c) => acc + c.total, 0);
  const totalDelivered = courierStats.reduce((acc, c) => acc + c.delivered, 0);
  const totalReturned = courierStats.reduce((acc, c) => acc + c.returned, 0);

  const successRatio = totalParcels
    ? ((totalDelivered / totalParcels) * 100).toFixed(1)
    : 0;
  const cancelRatio = totalParcels
    ? ((totalReturned / totalParcels) * 100).toFixed(1)
    : 0;
  return (
    <div className="space-y-1 text-center">
      <p>
        <span className="font-medium text-gray-800">Name:</span>{" "}
        {order?.shippingInfo?.fullName}
      </p>
      <p>
        <span className="font-medium text-gray-600">Phone:</span>{" "}
        {order?.shippingInfo?.phone}
      </p>
      <p>
        <span className="font-medium text-gray-600">Address:</span>{" "}
        {order?.shippingInfo?.address}
      </p>
      {/* <p>
        <span className="font-medium text-gray-600">Area:</span>{" "}
        {order?.shippingInfo?.area?.area_name}
      </p> */}
      {/* <p>
        <span className="font-medium text-gray-600">Delivery Zone:</span>{" "}
        {order?.shippingInfo?.deliveryZone}
      </p> */}

      <button
        onClick={openModal}
          className="bg-[#DCE8FF] font-medium py-1 px-3 rounded-3xl text-[#1D4ED8] hover:bg-[#C7DAFF] transition"
      >
        Fraud Check
      </button>

      <Modal isOpen={showModal} onClose={closeModal}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold">Fraud Customer Details</h2>
          <p className="font-bold">INV#ZAHIR4069</p>
          <p className="my-5 text-green-600 font-semibold">
            Parcel Receive & Cancel Ratio of:{" "}
            <span className="text-red-600">01323456789</span>
          </p>

          {/* === Table === */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto"></div>
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow className="uppercase text-center">
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                  >
                    Courier
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                  >
                    Total
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                  >
                    Delivered
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                  >
                    Returned
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                  >
                    Success Ratio
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {courierStats.map((c, idx) => (
                  <TableRow
                    key={idx}
                    className="dark:text-gray-400 text-center"
                  >
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {c.courier}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {c.total}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {c.delivered}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {c.returned}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm">
                      {c.ratio}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* === Progress Bar === */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Overall Success Ratio
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-green-500 h-3 rounded-full"
                style={{ width: `${successRatio}%` }}
              ></div>
            </div>
            <p className="text-right text-sm font-medium mt-1 text-green-600">
              {successRatio}%
            </p>
          </div>
          <div className="mt-1">
            <p className="text-sm font-semibold text-gray-700 mb-2">
              Overall Cancel Ratio
            </p>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-red-500 h-3 rounded-full"
                style={{ width: `${cancelRatio}%` }}
              ></div>
            </div>
            <p className="text-right text-sm font-medium mt-1 text-green-600">
              {cancelRatio}%
            </p>
          </div>

          <div className="flex justify-end mt-4 gap-x-2">
            <Button onClick={closeModal}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ShippingInfo;
