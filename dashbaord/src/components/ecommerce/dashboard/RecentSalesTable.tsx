import { formatCurrency, type RecentSale } from "./useDashboard";

const AVATAR_TONES = [
  "bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  "bg-blue-light-100 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-400",
  "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
];

const STATUS_TONES: Record<string, string> = {
  paid: "bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-400",
  partial: "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  due: "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400",
};

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("") || "?";

// The same customer keeps the same color from one visit to the next
export const avatarTone = (name: string) => {
  const sum = [...name].reduce((total, letter) => total + letter.charCodeAt(0), 0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
};

export const saleDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("en-GB", { day: "2-digit" });
  const month = date.toLocaleDateString("en-GB", { month: "short" });
  return `${day} ${month}, ${date.getFullYear()}`;
};

const HEAD_CELL = "px-3 py-2.5 text-xs font-medium text-gray-400";

const RecentSalesTable = ({ sales }: { sales: RecentSale[] }) => (
  <div className="-mx-1 overflow-x-auto">
    <table className="w-full min-w-[44rem] text-left text-sm">
      <thead>
        <tr className="border-b border-gray-100 dark:border-gray-800">
          <th className={HEAD_CELL}>Invoice</th>
          <th className={HEAD_CELL}>Customer</th>
          <th className={HEAD_CELL}>Date</th>
          <th className={`${HEAD_CELL} text-right`}>Payable</th>
          <th className={`${HEAD_CELL} text-right`}>Paid</th>
          <th className={`${HEAD_CELL} text-right`}>Due</th>
          <th className={HEAD_CELL}>Status</th>
        </tr>
      </thead>
      <tbody>
        {sales.map((sale) => (
          <tr
            key={sale.invoiceNumber}
            className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
          >
            <td className="whitespace-nowrap px-3 py-3.5 font-semibold text-gray-800 dark:text-gray-200">
              {sale.invoiceNumber}
            </td>
            <td className="px-3 py-3.5">
              <span className="flex items-center gap-2.5">
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(sale.customerName)}`}
                  aria-hidden="true"
                >
                  {initials(sale.customerName)}
                </span>
                <span className="max-w-[7rem] truncate font-medium text-gray-800 dark:text-gray-200" title={sale.customerName}>
                  {sale.customerName}
                </span>
              </span>
            </td>
            <td className="whitespace-nowrap px-3 py-3.5 text-gray-500 dark:text-gray-400">{saleDate(sale.createdAt)}</td>
            <td className="whitespace-nowrap px-3 py-3.5 text-right font-bold text-gray-800 dark:text-gray-200">
              {formatCurrency(sale.payable)}
            </td>
            <td className="whitespace-nowrap px-3 py-3.5 text-right font-semibold text-accent-600 dark:text-accent-400">
              {formatCurrency(sale.paid)}
            </td>
            <td
              className={`whitespace-nowrap px-3 py-3.5 text-right font-semibold ${
                sale.presentDue > 0 ? "text-error-600 dark:text-error-400" : "text-gray-400"
              }`}
            >
              {formatCurrency(sale.presentDue)}
            </td>
            <td className="px-3 py-3.5">
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${STATUS_TONES[sale.paymentStatus] ?? STATUS_TONES.due}`}
              >
                {sale.paymentStatus}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default RecentSalesTable;
