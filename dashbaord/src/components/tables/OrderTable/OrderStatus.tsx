import { useEffect, useState } from "react";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { showApiError } from "../../../utils/apiError";
import { ORDER_STATUSES, STATUS_LABELS, statusPillClass, type OrderStatusType } from "./orderMeta";

interface OrderStatusProps {
  order: {
    _id: string;
    orderStatus: OrderStatusType;
  };
  onChanged?: (status: OrderStatusType) => void;
}

// The status pill is itself the control: a native select dressed as the pill,
// so it stays keyboard- and screen-reader-friendly
const OrderStatus = ({ order, onChanged }: OrderStatusProps) => {
  const [status, setStatus] = useState<OrderStatusType>(order.orderStatus);
  const [saving, setSaving] = useState(false);

  useEffect(() => setStatus(order.orderStatus), [order.orderStatus]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as OrderStatusType;
    const previous = status;
    setStatus(next);
    setSaving(true);
    try {
      await axiosSecure.put(`/order/order-update/${order._id}`, { orderStatus: next });
      toast.success(`Order marked ${STATUS_LABELS[next]}`);
      onChanged?.(next);
    } catch (error) {
      showApiError(error, "Failed to update order status");
      setStatus(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className={`relative cursor-pointer pr-7 ${statusPillClass(status)} ${saving ? "opacity-60" : ""}`}>
      <span className="pointer-events-none">{STATUS_LABELS[status] ?? status}</span>
      <svg aria-hidden="true" viewBox="0 0 20 20" className="pointer-events-none absolute right-2 size-3.5 opacity-70">
        <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <select
        value={status}
        onChange={handleChange}
        disabled={saving}
        aria-label="Order status"
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </label>
  );
};

export default OrderStatus;
