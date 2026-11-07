import { Modal } from "../../ui/modal";

type FraudOrder = { invoiceId?: string; shippingInfo?: { fullName?: string; phone?: string } };

// No courier history service is connected yet, so these are not this customer's
// figures. The modal says so; replace them once a real source exists.
const SAMPLE_COURIER_STATS = [
  { courier: "Steadfast New", total: 7, delivered: 7, returned: 0 },
  { courier: "RedX", total: 25, delivered: 21, returned: 4 },
  { courier: "Pathao", total: 30, delivered: 26, returned: 4 },
];

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

const CELL = "px-3 py-2.5 text-right tabular-nums";
const HEAD = "px-3 py-2.5 text-right text-xs font-medium text-gray-400";

const Ratio = ({ label, value, tone }: { label: string; value: number; tone: string }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between text-sm">
      <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <span className="font-semibold tabular-nums text-gray-900 dark:text-white/90">{value}%</span>
    </div>
    <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10">
      <div className={`h-2 rounded-full ${tone}`} style={{ width: `${value}%` }} />
    </div>
  </div>
);

const FraudCheckModal = ({ order, onClose }: { order: FraudOrder; onClose: () => void }) => {
  const total = SAMPLE_COURIER_STATS.reduce((sum, row) => sum + row.total, 0);
  const delivered = SAMPLE_COURIER_STATS.reduce((sum, row) => sum + row.delivered, 0);
  const returned = SAMPLE_COURIER_STATS.reduce((sum, row) => sum + row.returned, 0);

  return (
    <Modal isOpen onClose={onClose} className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
      <div className="border-b border-gray-100 px-6 py-4 pr-14 dark:border-gray-800">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Fraud check</h2>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{order.invoiceId || "Order"}</p>
      </div>

      <div className="space-y-4 p-5">
        <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">
          Sample figures. No courier history service is connected yet, so do not judge this customer by these numbers.
        </p>

        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{order.shippingInfo?.fullName || "Customer"}</p>
          {order.shippingInfo?.phone && <p className="font-mono text-xs text-gray-500 dark:text-gray-400">{order.shippingInfo.phone}</p>}
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-800">
          <table className="w-full text-sm text-gray-700 dark:text-gray-300">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className={`${HEAD} text-left`}>Courier</th>
                <th className={HEAD}>Total</th>
                <th className={HEAD}>Delivered</th>
                <th className={HEAD}>Returned</th>
                <th className={HEAD}>Success</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {SAMPLE_COURIER_STATS.map((row) => (
                <tr key={row.courier}>
                  <td className="px-3 py-2.5 font-medium">{row.courier}</td>
                  <td className={CELL}>{row.total}</td>
                  <td className={CELL}>{row.delivered}</td>
                  <td className={CELL}>{row.returned}</td>
                  <td className={CELL}>{percent(row.delivered, row.total)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Ratio label="Overall success" value={percent(delivered, total)} tone="bg-accent-500" />
        <Ratio label="Overall returned" value={percent(returned, total)} tone="bg-error-500" />
      </div>
    </Modal>
  );
};

export default FraudCheckModal;
