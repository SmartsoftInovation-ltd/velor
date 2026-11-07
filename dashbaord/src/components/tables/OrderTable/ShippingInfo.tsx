import { useState } from "react";
import FraudCheckModal from "./FraudCheckModal";

const ShippingInfo = ({ order, hideFraudCheck = false }: { order: { invoiceId?: string; shippingInfo?: { fullName?: string; phone?: string; address?: string; city?: string; note?: string } }; hideFraudCheck?: boolean }) => {
  const [showModal, setShowModal] = useState(false);

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  return (
    <div className="min-w-0 space-y-1 text-left">
      <p className="truncate font-semibold text-gray-800 dark:text-white/90">
        {order?.shippingInfo?.fullName || "—"}
      </p>
      {order?.shippingInfo?.phone ? (
        <a
          href={`tel:${order.shippingInfo.phone}`}
          className="block font-mono text-xs text-gray-600 hover:text-accent-600 dark:text-gray-400 dark:hover:text-accent-400"
        >
          {order.shippingInfo.phone}
        </a>
      ) : null}
      <p className="line-clamp-2 max-w-full text-xs leading-relaxed text-gray-500 dark:text-gray-400" title={order?.shippingInfo?.address}>
        {[order?.shippingInfo?.address, order?.shippingInfo?.city].filter(Boolean).join(", ")}
      </p>
      {order?.shippingInfo?.note ? (
        <p className="max-w-full truncate text-xs italic text-gray-400" title={order.shippingInfo.note}>
          “{order.shippingInfo.note}”
        </p>
      ) : null}

      {!hideFraudCheck && (
      <button
        type="button"
        onClick={openModal}
        className="shine mt-0.5 rounded-full border border-accent-100 bg-accent-50 px-2.5 py-0.5 text-[11px] font-semibold text-accent-600 transition hover:bg-accent-100 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 dark:hover:bg-accent-500/25"
      >
        Fraud Check
      </button>
      )}

      {showModal && <FraudCheckModal order={order} onClose={closeModal} />}
    </div>
  );
};

export default ShippingInfo;
