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
import { FaEdit } from "react-icons/fa";
import OrderStatus from "./OrderStatus";
import ShippingInfo from "./ShippingInfo";
import { initSocket } from "../../../socket/socket";
import { Modal } from "../../ui/modal";
import EditShippingInfoModal from "./EditShippingInfoModal";
import { showApiError } from "../../../utils/apiError";

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
    | "Courier"
    | "Shipped"
    | "Delivered"
    | "Cancelled";
}
export default function IncompleteOrderTable() {
  const [orders, setOrders] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const tableData: Order[] = (orders ?? []).filter(
    (order: any) => order.orderType === "incomplete"
  );
  const fetchOrders = async () => {
    try {
      const { data } = await axiosSecure.get(`/order/allorders`);
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
  console.log(orders);

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
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const handleEditModal = (order: Order) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  return (
    <div>
      <div className="w-[700px]">
        <Input placeholder="Search by Order Name" className="mb-5" />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow className="uppercase text-center">
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Invoice ID
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
              {tableData.length > 0 ? (
                tableData.map((order, index) => (
                  <TableRow key={order._id} className="dark:text-gray-400 text-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <TableCell className="px-4 py-3 text-theme-sm">
                      <div className="space-y-1">
                        <p>
                          {order.invoiceId ? (
                            <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">{order.invoiceId}</span>
                          ) : (
                            <span className="font-medium text-gray-500 dark:text-gray-400">#{index + 1}</span>
                          )}
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
                              index !== order.items.length - 1
                                ? "border-b-2"
                                : ""
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
                      <OrderStatus order={order} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-theme-sm text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          onClick={() => handleEditModal(order)}
                          size="sm"
                          aria-label="Edit shipping info"
                          className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-warning-50 !text-warning-600 hover:!bg-warning-100 hover:!text-warning-700 dark:!bg-warning-500/15 dark:!text-warning-400 dark:hover:!bg-warning-500/25"
                        >
                          <FaEdit className="size-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteModal(order._id)}
                          size="sm"
                          aria-label="Delete order"
                          className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                        >
                          <MdDelete className="size-5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    //@ts-ignore
                    colSpan={7}
                    className="px-4 py-3 text-theme-sm text-center"
                  >
                    No incomplete orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <Modal isOpen={showDeleteModal} onClose={closeModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">Delete Order?</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to <span className="font-semibold text-red-500">delete</span> this order? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={closeModal} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 !bg-error-500 hover:!bg-error-600 !text-white !rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all disabled:active:scale-100"
            >
              {isDeleting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Deleting...
                </span>
              ) : (
                "Yes, Delete"
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <EditShippingInfoModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        orderId={selectedOrder?._id || null}
        shippingInfo={selectedOrder?.shippingInfo}
        fetchOrders={fetchOrders}
      />
    </div>
  );
}
