import { useState } from "react";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { showApiError } from "../../../utils/apiError";
import { Modal } from "../../ui/modal";
import { ORDER_STATUSES, STATUS_LABELS, toneOf, type OrderStatusType } from "./orderMeta";

type StatusOrder = { _id: string; invoiceId?: string; orderStatus: OrderStatusType };

// Picking a status does nothing until Update, so a stray click cannot move an order
const OrderStatusModal = ({
  order,
  onClose,
  onChanged,
}: {
  order: StatusOrder;
  onClose: () => void;
  onChanged: (status: OrderStatusType) => void;
}) => {
  const [next, setNext] = useState<OrderStatusType>(order.orderStatus);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving || next === order.orderStatus) return;
    setSaving(true);
    try {
      await axiosSecure.put(`/order/order-update/${order._id}`, { orderStatus: next });
      toast.success(`Order marked ${STATUS_LABELS[next]}`);
      onChanged(next);
      onClose();
    } catch (error) {
      showApiError(error, "Failed to update order status");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} className="w-full max-w-md">
      <div className="border-b border-gray-100 px-6 py-4 pr-14 dark:border-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Change order status</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {order.invoiceId ? `${order.invoiceId} · ` : ""}Now {STATUS_LABELS[order.orderStatus] ?? order.orderStatus}
        </p>
      </div>

      <fieldset className="grid grid-cols-1 gap-2 p-5 sm:grid-cols-2">
        <legend className="sr-only">New status</legend>
        {ORDER_STATUSES.map((status) => {
          const selected = next === status;
          return (
            <label
              key={status}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-500/30 ${
                selected
                  ? "border-accent-500 bg-accent-50 text-gray-900 dark:bg-accent-500/15 dark:text-white"
                  : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              <input type="radio" name="order-status" className="sr-only" checked={selected} onChange={() => setNext(status)} />
              <span className={`size-2 shrink-0 rounded-full ${toneOf(status).dot}`} aria-hidden="true" />
              {STATUS_LABELS[status]}
            </label>
          );
        })}
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-gray-100 p-4 dark:border-gray-800">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || next === order.orderStatus}
          onClick={save}
          className="shine h-10 rounded bg-accent-500 px-4 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Updating…" : "Update status"}
        </button>
      </div>
    </Modal>
  );
};

export default OrderStatusModal;
