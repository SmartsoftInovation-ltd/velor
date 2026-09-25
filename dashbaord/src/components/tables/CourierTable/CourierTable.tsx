import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Input from "../../form/input/InputField";
import Button from "../../ui/button/Button";
import Badge from "../../ui/badge/Badge";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
// import { Link } from "react-router";
import moment from "moment";
import { MdDelete } from "react-icons/md";
// import { FaEdit } from "react-icons/fa";
import { initSocket } from "../../../socket/socket";
import { Modal } from "../../ui/modal";
import ShippingInfo from "../OrderTable/ShippingInfo";
import DatePicker from "../../form/date-picker";
import { FcManager } from "react-icons/fc";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";
import { scopedStorageKey } from "../../../lib/session";

interface Order {
  createdAt: string;
  totalAmount: string;
  items: any;
  _id: any;
  guestId?: string | null;
  shippingInfo: any;
  invoiceId: String;
  finalAmount: number;
  discountAmount: number;
  deliveryCharge: {
    deliveryCharge: number;
  };
  orderStatus:
    | "Pending"
    | "Hold"
    | "Confirmed"
    | "Packaging"
    | "CourierPending"
    | "Courier"
    | "Shipped"
    | "Delivered"
    | "Cancelled";
}
export default function CourierTable() {
  const [orders, setOrders] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [selectedCourier, setSelectedCourier] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const isMobile = useIsMobile();
  const tableData: Order[] = orders ?? [];
  // const tableData: Order[] = (orders ?? []).filter(
  //   (order: any) => order.orderType === "complete"
  // );
  const fetchOrders = async () => {
    try {
      const { data } = await axiosSecure.get(
        `/order/getallcourierpendingorder`
      );
      setOrders(data.data);
    } catch (error) {
      showApiError(error, "Error fetching orders");
    }
  };
  useEffect(() => {
    fetchOrders();
    const socket = initSocket();
    //@ts-ignore
    socket.on("connect", () => {
      toast.success("Connected to server");
    });

    // listen for new orders
    socket.on("orderPlaced", (data: any) => {
      toast.success(data.message || "New order received!");
      //@ts-ignore
      setOrders((prev) => [data.order, ...prev]);
    });

    // cleanup
    return () => {
      socket.off("orderPlaced");
    };
  }, []);
  // console.log(orders);

  const handleDeleteModal = (id: string) => {
    setSelectedOrderId(id);
    setShowDeleteModal(true);
  };
  const closeModal = () => {
    setShowDeleteModal(false);
  };
  const handleDelete = async () => {
    // Guard against a second click while the first request is still running.
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/order/delete-Order/${selectedOrderId}`);
      toast.success("Order deleted successfully.");

      fetchOrders();
    } catch (error) {
      console.error("Error deleting order:", error);
      showApiError(error, "Failed to delete the order. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelectedOrderId(null);
    }
  };
  useEffect(() => {
    if (!selectedCourier) {
      setMerchantId("");
      return;
    }

    const key = scopedStorageKey(`merchantId_${selectedCourier.toLowerCase()}`);
    const storedMerchantId = localStorage.getItem(key);
    setMerchantId(storedMerchantId || "");
  }, [selectedCourier]);

  // Inside your component, below merchantId state
  const handleCourierSend = async (orderId: string) => {
    if (!orderId) return toast.error("Invalid order ID!");
    if (!selectedCourier) return toast.error("Please select a courier!");
    if (!merchantId) return toast.error("Merchant ID is missing!");

    const apiUrl = `/courier/${selectedCourier.toLowerCase()}-create-order`;

    const payload = { merchantId, orderId };

    console.log("Sending to courier:", payload); // Debugging

    try {
      const { data } = await axiosSecure.post(apiUrl, payload);
      toast.success(data.message || "Order sent to courier successfully!");
      fetchOrders();
    } catch (error: any) {
      console.error("Courier send error:", error.response?.data || error);
      toast.error(
        error.response?.data?.message || "Failed to send order to courier!"
      );
    }
  };

  return (
    <div>
      <div className="py-4  mb-5">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* From Date */}
          <div className="w-full">
            <DatePicker
              id="date-picker-from"
              label="From Date"
              placeholder="Select a date"
            />
          </div>

          {/* To Date */}
          <div className="w-full">
            <DatePicker
              id="date-picker-to"
              label="To Date"
              placeholder="Select a date"
            />
          </div>

          {/* Courier Dropdown */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Courier
            </label>
            <select
              value={selectedCourier}
              onChange={(e) => setSelectedCourier(e.target.value)}
              className="border-2 rounded-md px-3 py-2.5 text-sm focus:outline-none w-full"
            >
              <option value="">Select Courier</option>
              <option value="steadfast">SteadFast</option>
              <option value="pathao">Pathao</option>
              <option value="redx">RedX</option>
              <option value="paperfly">PaperFly</option>
              <option value="ecourier">eCourier</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Merchant ID
            </label>
            <input
              type="text"
              value={merchantId}
              readOnly
              className="w-full border px-3 py-2 rounded-md bg-gray-100 text-gray-600"
            />
          </div>
          {/* Send Button */}
          <div className="w-full">
            <button className="bg-brand-600 text-white px-6 py-2.5 rounded-md hover:bg-brand-700 w-full">
              Bluk Courier Send
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[700px] my-5">
        <Input placeholder="Search by Order Name" className="mb-5" />
      </div>

      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(order) => order._id}
          emptyMessage="No orders found"
          renderCard={(order) => (
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white/90">
                    {order.invoiceId}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {moment(order?.createdAt).format("YYYY-MM-DD HH:mm")}
                  </span>
                </div>
                <Badge color="orange">{order.orderStatus}</Badge>
              </div>
              <div className="mb-2">
                <ShippingInfo order={order} />
              </div>
              <MobileCardRow label="Customer Type">
                <Badge color={order.guestId ? "orange" : "info"}>
                  {order.guestId ? "Guest" : "User"}
                </Badge>
              </MobileCardRow>
              <MobileCardRow label="Items">{order?.items?.length ?? 0}</MobileCardRow>
              <MobileCardRow label="Total">৳{order?.totalAmount || 0}</MobileCardRow>
              <MobileCardRow label="Discount">-৳{order?.discountAmount || 0}</MobileCardRow>
              <MobileCardRow label="Delivery">+৳{order?.deliveryCharge?.deliveryCharge || 0}</MobileCardRow>
              <MobileCardRow label="Final">৳{order?.finalAmount || 0}</MobileCardRow>
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                <Button
                  className="max-md:size-11 p-0 bg-[#D5F0E3] hover:bg-[#B8E4CF]"
                  onClick={() => handleCourierSend(order._id.toString())}
                  size="sm"
                >
                  <FcManager />
                </Button>
                <Button
                  onClick={() => handleDeleteModal(order._id)}
                  size="sm"
                  className="max-md:size-11 p-0 bg-red-500 text-white hover:bg-red-600"
                >
                  <MdDelete />
                </Button>
              </div>
            </div>
          )}
        />
      ) : (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow className="uppercase text-center">
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Invoice ID.
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Customer Info
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Products
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
                  Customer Type
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y-2 divide-gray-200 dark:divide-white/[0.05]">
              {tableData.map((order) => (
                <TableRow className="dark:text-gray-400 text-center hover:bg-gray-50">
                  <TableCell className="px-4 py-3 text-theme-sm">
                    <div className="space-y-1">
                      <p className="font-medium text-gray-800">
                        {order.invoiceId}
                      </p>
                      <p className="text-gray-600">
                        {moment(order?.createdAt).format("YYYY-MM-DD")}
                      </p>
                      <p className="text-gray-600">
                        {moment(order?.createdAt).format("HH:mm")}
                      </p>
                      <p className="text-sm text-gray-500 italic">
                        {moment(order?.createdAt).fromNow()}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    <ShippingInfo order={order} />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm">
                    {order?.items && order.items.length > 0 ? (
                      order.items.map((item: any, index: number) => (
                        <div
                          key={item._id}
                          className={`${
                            index !== order.items.length - 1 ? "border-b-2" : ""
                          } py-2`}
                        >
                          <div className="flex gap-2">
                            {item?.product?.image?.length > 0 &&
                              item.product.image.map(
                                (img: string, idx: number) => (
                                  <img
                                    key={idx}
                                    src={img}
                                    alt={
                                      item?.product?.name || `Product-${idx}`
                                    }
                                    className="w-10 h-10 object-cover rounded m-auto"
                                  />
                                )
                              )}

                            {/* Variant image */}
                            {item?.variant?.image && (
                              <img
                                src={item.variant.image}
                                alt={item.variant.variantName}
                                className="w-10 h-10 object-cover rounded m-auto"
                              />
                            )}
                          </div>
                          <p>
                            <span className="font-semibold">Name</span>:{" "}
                            {item?.product?.name || ""}
                            {item?.variant?.variantName || ""}
                          </p>
                          <p>
                            <span className="font-semibold">Color</span>:{" "}
                            {item?.color || "N/A"}
                          </p>
                          <p>
                            <span className="font-semibold">Size</span>:{" "}
                            {item?.size || "N/A"}
                          </p>

                          <p>
                            {item.orderType === "singlevariant" ? (
                              <>
                                <span className="font-semibold">Price: </span>
                                {item.quantity} * {item.retailPrice} ={" "}
                                {item.totalPrice}
                              </>
                            ) : (
                              <>
                                <span className="font-semibold">Price: </span>
                                {item.quantity} * {item.retailPrice} ={" "}
                                {item.totalPrice}
                              </>
                            )}
                          </p>
                          <p>
                            <span className="font-semibold">SKU</span>:{" "}
                            {item?.orderType === "singlevariant"
                              ? item?.product?.sku || ""
                              : item?.variant?.sku || ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 italic">No items found.</p>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm text-center">
                    <div className="space-y-1">
                      <p>
                        <span className="font-semibold">Total:</span> ৳
                        {order?.totalAmount || 0}
                      </p>
                      <p>
                        <span className="font-semibold">Discount:</span> -৳
                        {order?.discountAmount || 0}
                      </p>
                      <p>
                        <span className="font-semibold">Delivery:</span> +৳
                        {order?.deliveryCharge?.deliveryCharge || 0}
                      </p>
                      <p className="font-bold border-t pt-1">
                        <span className="font-semibold">Final:</span> ৳
                        {order?.finalAmount || 0}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm text-center">
                    <Badge color={order.guestId ? "orange" : "info"}>
                      {order.guestId ? "Guest" : "User"}
                    </Badge>
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm">
                    <Badge color="orange">{order.orderStatus}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        className="bg-[#D5F0E3] hover:bg-[#B8E4CF]"
                        onClick={() => handleCourierSend(order._id.toString())}
                        size="sm"
                      >
                        <FcManager />
                      </Button>
                      <Button
                        onClick={() => handleDeleteModal(order._id)}
                        size="sm"
                        className="bg-red-500 text-white hover:bg-red-600"
                      >
                        <MdDelete />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      )}
      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-lg font-bold">Confirm Deletion</h2>
          <p className="mt-2 text-gray-600">
            Are you sure you want to delete this order?
          </p>
          <div className="flex justify-end mt-4 gap-x-2">
            <Button onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Deleting...
                </span>
              ) : (
                "Yes"
              )}
            </Button>
            <Button
              onClick={closeModal}
                className="bg-[#D5F0E3] text-[#0A6B43] hover:bg-[#B8E4CF]"
            >
              No
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
