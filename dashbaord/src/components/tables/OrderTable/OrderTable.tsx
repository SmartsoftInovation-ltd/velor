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
import { usePermission } from "../../../hooks/usePermission";
import OrderStatus from "./OrderStatus";
import ShippingInfo from "./ShippingInfo";
import { initSocket } from "../../../socket/socket";
import { Modal } from "../../ui/modal";
import { Link } from "react-router";
import { IoIosPrint } from "react-icons/io";
import { TbSticker2 } from "react-icons/tb";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

interface Order {
  createdAt: string;
  totalAmount: string;
  items: any;
  _id: any;
  guestId?: string | null;
  shippingInfo: any;
  invoiceId: String;
  // Where the customer reached the shop: "Website" for a storefront checkout,
  // or whatever the staff member picked when entering the order by hand.
  orderFrom?: string;
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
export default function OrderTable() {
  const canDelete = usePermission("order", "delete");
  const isMobile = useIsMobile();
  const [orders, setOrders] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  // const tableData: Order[] = orders ?? [];
  const tableData: Order[] = (orders ?? []).filter(
    (order: any) => order.orderType === "complete"
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
  return (
    <div>
      <div className="w-full max-w-[700px]">
        <Input placeholder="Search by Order Name" className="mb-5" />
      </div>

      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(order) => order._id}
          emptyMessage="No orders found"
          renderCard={(order, index) => (
            <div className="space-y-1">
              <div className="mb-2 flex items-start justify-between gap-3 border-b border-gray-100 pb-2 dark:border-white/[0.05]">
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-400">{order.invoiceId || `#${index + 1}`}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {moment(order?.createdAt).format("YYYY-MM-DD HH:mm")}
                  </p>
                </div>
                <Badge color={order.guestId ? "orange" : "info"}>
                  {order.guestId ? "Guest" : "User"}
                </Badge>
              </div>
              <div className="pb-2">
                <ShippingInfo order={order} />
              </div>
              <MobileCardRow label="Items">
                {order?.items?.length || 0}
              </MobileCardRow>
              <MobileCardRow label="Total">
                ৳{order?.totalAmount || 0}
              </MobileCardRow>
              <MobileCardRow label="Delivery">
                +৳{order?.deliveryCharge?.deliveryCharge || 0}
              </MobileCardRow>
              <MobileCardRow label="Order From">
                {order?.orderFrom || "—"}
              </MobileCardRow>
              <MobileCardRow label="Final">
                <span className="font-bold">৳{order?.finalAmount || 0}</span>
              </MobileCardRow>
              <div className="pt-2">
                <OrderStatus order={order} />
              </div>
              <div className="mt-2 flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-white/[0.05]">
                <Link to={`/sticker/${order._id}`} aria-label="Print sticker" className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 max-md:size-11">
                  <TbSticker2 className="size-4" />
                </Link>
                <Link to={`/invoice/${order._id}`} aria-label="Print invoice" className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 max-md:size-11">
                  <IoIosPrint className="size-4" />
                </Link>
                {canDelete && (
                  <Button
                    onClick={() => handleDeleteModal(order._id)}
                    size="sm"
                    aria-label="Delete order"
                    className="max-md:size-11 size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                  >
                    <MdDelete className="size-5" />
                  </Button>
                )}
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
                  Order From
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
              {tableData.map((order, index) => (
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
                  <TableCell className="px-4 py-3 text-theme-sm text-center">
                    {order?.orderFrom ? (
                      <Badge color="light">{order.orderFrom}</Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>

                  <TableCell className="px-4 py-3 text-theme-sm">
                    <OrderStatus order={order} />
                  </TableCell>
                  <TableCell className="px-4 py-3 text-theme-sm text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Link to={`/sticker/${order._id}`} aria-label="Print sticker" className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10">
                        <TbSticker2 className="size-4" />
                      </Link>
                      <Link to={`/invoice/${order._id}`} aria-label="Print invoice" className="shine flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10">
                        <IoIosPrint className="size-4" />
                      </Link>
                      {canDelete && (
                      <Button
                        onClick={() => handleDeleteModal(order._id)}
                        size="sm"
                        aria-label="Delete order"
                        className="size-10 p-0 !rounded border-none transition-all active:scale-90 !bg-error-50 !text-error-600 hover:!bg-error-100 dark:!bg-error-500/15 dark:!text-error-400 dark:hover:!bg-error-500/25"
                      >
                        <MdDelete className="size-5" />
                      </Button>
                      )}
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
    </div>
  );
}
