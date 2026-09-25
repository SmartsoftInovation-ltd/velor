// import { useState } from "react";
// import Badge from "../../ui/badge/Badge";
// import axiosSecure from "../../../hooks/useAxiosSecure";
// import toast from "react-hot-toast";

// type OrderStatusType =
//   | "Pending"
//   | "Hold"
//   | "Confirmed"
//   | "Packaging"
//   | "CourierPending"
//   | "Courier"
//   | "Shipped"
//   | "Delivered"
//   | "Cancelled";

// type BadgeColor =
//   | "primary"
//   | "success"
//   | "orange"
//   | "error"
//   | "warning"
//   | "info"
//   | "secondary"
//   | "purple";

// interface OrderStatusProps {
//   order: {
//     _id: string;
//     orderStatus: OrderStatusType;
//   };
// }

// const OrderStatus = ({ order }: OrderStatusProps) => {
//   const [status, setStatus] = useState<OrderStatusType>(order.orderStatus);

//   const statuses: OrderStatusType[] = [
//     "Pending",
//     "Hold",
//     "Confirmed",
//     "Packaging",
//     "CourierPending",
//     "Courier",
//     "Shipped",
//     "Delivered",
//     "Cancelled",
//   ];

//   const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
//     const newStatus = e.target.value as OrderStatusType;
//     setStatus(newStatus);

//     try {
//       await axiosSecure.put(`/order/order-update/${order._id}`, {
//         orderStatus: newStatus,
//       });
//       toast.success("Order Status Updated");
//     } catch (error) {
//       toast.error("Failed to update order status");
//       setStatus(order.orderStatus);
//     }
//   };

//   const getBadgeColor = (s: OrderStatusType): BadgeColor => {
//     switch (s?.toLowerCase()) {
//       case "pending":
//         return "warning";
//       case "hold":
//         return "secondary";
//       case "confirmed":
//         return "info";
//       case "packaging":
//         return "purple";
//       case "CourierPending":
//         return "purple";
//       case "courier":
//         return "primary";
//       case "shipped":
//         return "orange";
//       case "delivered":
//         return "success";
//       case "cancelled":
//         return "error";
//       default:
//         return "warning";
//     }
//   };

//   return (
//     <div className="flex items-center gap-2">
//       <Badge
//         //@ts-ignore - Badge component may not accept `BadgeColor` type directly
//         color={getBadgeColor(status)}
//       >
//         {status}
//       </Badge>
//       <select
//         value={status}
//         onChange={handleChange}
//         className="border rounded-md px-2 py-1 text-sm focus:outline-none"
//       >
//         {statuses.map((s) => (
//           <option key={s} value={s}>
//             {s}
//           </option>
//         ))}
//       </select>
//     </div>
//   );
// };

// export default OrderStatus;
import { useState } from "react";
import Badge from "../../ui/badge/Badge";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { showApiError } from "../../../utils/apiError";

type OrderStatusType =
  | "Pending"
  | "Hold"
  | "Confirmed"
  | "Packaging"
  | "CourierPending"
  | "Courier"
  | "Shipped"
  | "Delivered"
  | "Cancelled";

type BadgeColor =
  | "primary"
  | "success"
  | "orange"
  | "error"
  | "warning"
  | "info"
  | "secondary"
  | "purple";

interface OrderStatusProps {
  order: {
    _id: string;
    orderStatus: OrderStatusType;
  };
}

const OrderStatus = ({ order }: OrderStatusProps) => {
  const [status, setStatus] = useState<OrderStatusType>(order.orderStatus);

  // List of possible enum values (must match backend)
  const statuses: OrderStatusType[] = [
    "Pending",
    "Hold",
    "Confirmed",
    "Packaging",
    "CourierPending",
    "Courier",
    "Shipped",
    "Delivered",
    "Cancelled",
  ];

  // Map each enum value to a more readable label for UI
  const statusLabels: Record<OrderStatusType, string> = {
    Pending: "Pending",
    Hold: "Hold",
    Confirmed: "Confirmed",
    Packaging: "Packaging",
    CourierPending: "Courier Pending",
    Courier: "Courier",
    Shipped: "Shipped",
    Delivered: "Delivered",
    Cancelled: "Cancelled",
  };

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as OrderStatusType;
    setStatus(newStatus);

    try {
      await axiosSecure.put(`/order/order-update/${order._id}`, {
        orderStatus: newStatus,
      });
      toast.success("Order Status Updated");
    } catch (error) {
      showApiError(error, "Failed to update order status");
      // roll back to original
      setStatus(order.orderStatus);
    }
  };

  const getBadgeColor = (s: OrderStatusType): BadgeColor => {
    switch (s.toLowerCase()) {
      case "pending":
        return "warning";
      case "hold":
        return "secondary";
      case "confirmed":
        return "info";
      case "packaging":
        return "purple";
      case "courierpending": // note: comparing lowercase
        return "purple";
      case "courier":
        return "primary";
      case "shipped":
        return "orange";
      case "delivered":
        return "success";
      case "cancelled":
        return "error";
      default:
        return "warning";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Badge
        //@ts-ignore
        color={getBadgeColor(status)}
      >
        {statusLabels[status]}
      </Badge>
      <select
        value={status}
        onChange={handleChange}
        aria-label="Order status"
        className="h-9 rounded-md border border-gray-300 bg-transparent px-2 text-sm text-gray-700 focus:border-accent-300 focus:outline-none focus:ring-3 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {statusLabels[s]}
          </option>
        ))}
      </select>
    </div>
  );
};

export default OrderStatus;
