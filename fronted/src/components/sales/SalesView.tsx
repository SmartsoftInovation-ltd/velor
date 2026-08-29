import { useParams, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import { FaSync } from "react-icons/fa";
import { FiBox, FiFileText, FiPrinter } from "react-icons/fi";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import Button from "../ui/button/Button";

// ---------- Types ----------
interface VariantRef {
  _id?: string;
  variantName?: string;
  sku?: string;
  barCode?: string;
  size?: string;
  color?: string;
  thumbnail?: { url?: string };
}

interface ProductRef {
  _id?: string;
  name?: string;
  sku?: string;
  barCode?: string;
  thumbnail?: { url?: string };
}

interface SearchItem {
  productId?: ProductRef | null;
  variantId?: VariantRef | null;
  salesStatus?: string;
  barcode?: string;
  productDescription?: string;
  color?: string;
  size?: string;
  quantity?: number;
  groupQuantity?: number;
  unit?: string;
  salesRate?: number;
  discount?: number;
  subtotal?: number;
}

interface Payment {
  amount?: number;
  paymentTo?: { _id?: string; name?: string } | string | null;
  remark?: string;
}

interface Sale {
  _id: string;
  invoiceNumber: string;
  date: string;
  deliveryDate?: string;
  createdAt?: string;
  updatedAt?: string;
  salesType: string;
  invoiceStatus: string;
  paymentStatus: string;
  remark?: string;
  sendSms?: boolean;
  searchItem: SearchItem[];
  customerType: {
    type: "listed" | "walking";
    walking?: {
      customerName?: string;
      mobileNumber?: string;
      email?: string;
      address?: string;
    } | null;
    customerId?: {
      _id?: string;
      fullName?: string;
      mobileNumber?: string;
      emailAddress?: string;
      presentAddress?: string;
      customerId?: string;
    } | null;
  };
  salesMen?: {
    fullName?: string;
    employeeId?: string;
    email?: string;
    mobile?: string;
  } | null;
  total: number;
  return?: number;
  discountPercent: number;
  vatPercent: number;
  deliveryCost: number;
  labourCost: number;
  lessTaka: number;
  customerAdvancePaymentAdjust: number;
  payable: number;
  paid: number;
  changes: number;
  presentDue: number;
  previousDue: number;
  balance: number;
  paymentMethod?: {
    singlePayment?: Payment | null;
    multiplePayment?: Payment[];
  };
}

const salesTypeLabel: Record<string, string> = {
  wholesale: "Wholesale",
  retailsale: "Retail Sale",
  retailsaleorder: "Retail Sale Order",
  wholesaleorder: "Wholesale Order",
};

const money = (n = 0) =>
  `৳ ${Math.round(Number(n || 0)).toLocaleString("en-US")}`;

const statusTone: Record<string, string> = {
  paid: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  partial: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  due: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
  complete: "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400",
  draft: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300",
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
};

// ---------- Bits ----------
const InfoCard = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
      {label}
    </p>
    <div className="text-sm font-semibold text-gray-800 dark:text-white">
      {value || "—"}
    </div>
  </div>
);

const Pill = ({ value }: { value?: string }) => (
  <span
    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
      statusTone[value || ""] ||
      "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
    }`}
  >
    {value || "—"}
  </span>
);

const Field = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <div>
    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">
      {label}
    </p>
    <div className="font-semibold text-gray-800 dark:text-white text-sm break-words">
      {value || "—"}
    </div>
  </div>
);

const TotalLine = ({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "red" | "green";
}) => (
  <div
    className={`flex justify-between py-1.5 ${bold ? "font-black" : "font-medium"}`}
  >
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span
      className={
        tone === "red"
          ? "text-red-500"
          : tone === "green"
            ? "text-green-600"
            : "text-gray-800 dark:text-white"
      }
    >
      {value}
    </span>
  </div>
);

// ---------- Component ----------
const SalesView = () => {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const navigate = useNavigate();

  const {
    data: sale,
    isLoading,
    isError,
    refetch,
  } = useQuery<Sale>({
    queryKey: ["sale-invoice", invoiceNumber],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/sales/get-sales?invoiceNumber=${encodeURIComponent(invoiceNumber || "")}`,
      );
      const list = data.data || [];
      return Array.isArray(list) ? list[0] : list;
    },
    enabled: !!invoiceNumber,
  });

  if (isLoading)
    return (
      <div className="flex justify-center min-h-100 items-center">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );

  if (isError || !sale)
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-center">
        <p className="text-red-500 font-bold text-lg mb-4">
          Failed to load sale!
        </p>
        <Button
          onClick={() => refetch()}
          className="px-6 py-2 bg-brand-500 text-white rounded-xl"
        >
          Try Again
        </Button>
      </div>
    );

  const ct = sale.customerType;
  const isListed = ct?.type === "listed";
  const customerName = isListed
    ? ct.customerId?.fullName
    : ct?.walking?.customerName;
  const customerMobile = isListed
    ? ct.customerId?.mobileNumber
    : ct?.walking?.mobileNumber;
  const customerEmail = isListed
    ? ct.customerId?.emailAddress
    : ct?.walking?.email;
  const customerAddress = isListed
    ? ct.customerId?.presentAddress
    : ct?.walking?.address;

  const items = sale.searchItem || [];
  const totalQty = items.reduce((n, i) => n + (i.quantity || 0), 0);
  const discountAmt = (sale.total * (sale.discountPercent || 0)) / 100;
  const vatAmt = ((sale.total - discountAmt) * (sale.vatPercent || 0)) / 100;

  // Every payment on the sale, regardless of which slot it was stored in —
  // single and multiple are just storage shapes, and a sale can carry both.
  const payments = [
    ...(sale.paymentMethod?.singlePayment
      ? [sale.paymentMethod.singlePayment]
      : []),
    ...(sale.paymentMethod?.multiplePayment ?? []),
  ].filter((p) => p && (p.amount ?? 0) > 0);

  const accountName = (p: Payment) =>
    typeof p.paymentTo === "object" && p.paymentTo?.name
      ? p.paymentTo.name
      : "Cash";
  const totalPaidOnAccounts = payments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0,
  );

  const enc = encodeURIComponent(sale.invoiceNumber);

  return (
    <>
      <PageMeta
        title={`Sale ${sale.invoiceNumber} - Baig Ecommerce`}
        description="Sale details"
      />
      <PageBreadcrumb pageTitle="Sale Details" />

      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900 px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 px-4 h-10 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-brand-500 font-semibold text-sm transition-all active:scale-95"
            >
              <svg
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back
            </Button>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 px-4 h-10 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-brand-500 font-semibold text-sm transition-all active:scale-95"
            >
              <FaSync className="size-3.5" />
              Refresh
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(`/sales-receipt-print/${enc}`)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 px-4 h-10 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-brand-500 font-semibold text-sm transition-all active:scale-95"
            >
              <FiPrinter className="size-3.5" />
              Receipt
            </Button>
            <Button
              onClick={() => navigate(`/sales-invoice-print/${enc}`)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 px-4 h-10 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-brand-500 font-semibold text-sm transition-all active:scale-95"
            >
              <FiFileText className="size-3.5" />
              Invoice
            </Button>
            <Button
              onClick={() => navigate(`/sales-challan-print/${enc}`)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 px-4 h-10 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-brand-500 font-semibold text-sm transition-all active:scale-95"
            >
              <FiBox className="size-3.5" />
              Challan
            </Button>
          </div>
        </div>

        {/* Sale info */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <div>
              <h2 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">
                Invoice #{sale.invoiceNumber}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Created{" "}
                {moment(sale.createdAt || sale.date).format(
                  "DD MMM YYYY, hh:mm A",
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Pill value={sale.invoiceStatus} />
              <Pill value={sale.paymentStatus} />
            </div>
          </div>

          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard label="Invoice Number" value={sale.invoiceNumber} />
            <InfoCard
              label="Sale Date"
              value={moment(sale.date).format("DD MMM YYYY")}
            />
            <InfoCard
              label="Sale Type"
              value={salesTypeLabel[sale.salesType] || sale.salesType}
            />
            <InfoCard
              label="Balance"
              value={
                <span
                  className={
                    sale.balance > 0 ? "text-red-500" : "text-green-600"
                  }
                >
                  {money(sale.balance)}
                </span>
              }
            />
            {sale.deliveryDate && (
              <InfoCard
                label="Delivery Date"
                value={moment(sale.deliveryDate).format("DD MMM YYYY")}
              />
            )}
            <InfoCard label="Total Items" value={String(items.length)} />
            <InfoCard label="Total Qty" value={String(totalQty)} />
            <InfoCard label="SMS Sent" value={sale.sendSms ? "Yes" : "No"} />
          </div>

          {/* Customer */}
          <div className="px-6 pb-6">
            <div className="bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  Customer Information
                </p>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-500 text-[9px] font-black uppercase">
                  {ct?.type || "—"}
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Name" value={customerName || "Walking Customer"} />
                <Field label="Mobile" value={customerMobile} />
                <Field label="Email" value={customerEmail} />
                <Field label="Address" value={customerAddress} />
                {isListed && ct.customerId?.customerId && (
                  <Field label="Customer ID" value={ct.customerId.customerId} />
                )}
              </div>
            </div>
          </div>

          {/* Salesman */}
          {sale.salesMen && (
            <div className="px-6 pb-6">
              <div className="bg-violet-50/50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/20 rounded-xl p-4">
                <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-3">
                  Salesman Information
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Name" value={sale.salesMen.fullName} />
                  <Field label="Employee ID" value={sale.salesMen.employeeId} />
                  <Field label="Mobile" value={sale.salesMen.mobile} />
                  <Field label="Email" value={sale.salesMen.email} />
                </div>
              </div>
            </div>
          )}

          {/* Remark */}
          {sale.remark && (
            <div className="px-6 pb-6">
              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl p-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Remark
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {sale.remark}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <h3 className="text-sm font-black text-gray-800 dark:text-white">
              Items ({items.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <Th className="w-10 text-left">#</Th>
                  <Th className="text-left">PRODUCT</Th>
                  <Th>BARCODE</Th>
                  <Th>SKU</Th>
                  <Th>COLOR</Th>
                  <Th>SIZE</Th>
                  <Th>STATUS</Th>
                  <Th>QTY</Th>
                  <Th>RATE</Th>
                  <Th>DISCOUNT</Th>
                  <Th className="text-right">SUBTOTAL</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const thumb =
                    item.variantId?.thumbnail?.url ||
                    item.productId?.thumbnail?.url;
                  return (
                    <tr
                      key={i}
                      className="border-b border-gray-100 dark:border-gray-800"
                    >
                      <Td className="text-gray-400">{i + 1}</Td>
                      <Td className="text-left">
                        <div className="flex items-center gap-2.5">
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="size-9 rounded-lg object-cover border border-gray-100 dark:border-gray-700 shrink-0"
                            />
                          ) : (
                            <div className="size-9 rounded-lg bg-gray-100 dark:bg-gray-800 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 dark:text-white truncate">
                              {item.productDescription ||
                                item.productId?.name ||
                                "—"}
                            </p>
                            {item.variantId?.variantName && (
                              <p className="text-[10px] text-gray-400 truncate">
                                {item.variantId.variantName}
                              </p>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td>{item.barcode || item.variantId?.barCode || "—"}</Td>
                      <Td>{item.variantId?.sku || item.productId?.sku || "—"}</Td>
                      <Td>{item.color || "—"}</Td>
                      <Td>{item.size || "—"}</Td>
                      <Td>
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 text-[9px] font-black uppercase">
                          {item.salesStatus || "sale"}
                        </span>
                      </Td>
                      <Td className="font-bold text-gray-800 dark:text-white">
                        {item.quantity ?? 0}
                        {item.unit ? (
                          <span className="text-[10px] text-gray-400 font-medium">
                            {" "}
                            {item.unit}
                          </span>
                        ) : null}
                        {(item.groupQuantity ?? 0) > 0 && (
                          <p className="text-[10px] text-gray-400 font-medium">
                            Group: {item.groupQuantity}
                          </p>
                        )}
                      </Td>
                      <Td>{money(item.salesRate)}</Td>
                      <Td>{money(item.discount)}</Td>
                      <Td className="text-right font-bold text-gray-800 dark:text-white">
                        {money(item.subtotal)}
                      </Td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-10 text-center text-sm text-gray-400"
                    >
                      No items on this sale.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 dark:bg-gray-800/50">
                  <td
                    colSpan={7}
                    className="px-4 py-3 text-xs font-black text-gray-800 dark:text-white"
                  >
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-xs font-black text-center text-gray-800 dark:text-white">
                    {totalQty}
                  </td>
                  <td colSpan={2} />
                  <td className="px-4 py-3 text-xs font-black text-right text-gray-800 dark:text-white">
                    {money(sale.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Payments + totals */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Payments */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <h3 className="text-sm font-black text-gray-800 dark:text-white">
                Payments
              </h3>
            </div>
            <div className="p-6">
              {payments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No payment recorded on this sale.
                </p>
              ) : (
                <div className="space-y-3">
                  {payments.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-800 dark:text-white">
                          {accountName(p)}
                        </p>
                        {p.remark && (
                          <p className="text-[11px] text-gray-400 mt-0.5 break-words">
                            {p.remark}
                          </p>
                        )}
                      </div>
                      <p className="text-sm font-black text-gray-800 dark:text-white shrink-0">
                        {money(p.amount)}
                      </p>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 border-t border-gray-100 dark:border-gray-800 text-sm font-black">
                    <span className="text-gray-500 dark:text-gray-400">
                      Total Paid
                    </span>
                    <span className="text-gray-800 dark:text-white">
                      {money(totalPaidOnAccounts)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
              <h3 className="text-sm font-black text-gray-800 dark:text-white">
                Summary
              </h3>
            </div>
            <div className="p-6 text-sm">
              <TotalLine label="Subtotal" value={money(sale.total)} />
              <TotalLine
                label={`Discount (${sale.discountPercent || 0}%)`}
                value={`-${money(discountAmt)}`}
              />
              <TotalLine
                label={`VAT (${sale.vatPercent || 0}%)`}
                value={money(vatAmt)}
              />
              <TotalLine label="Delivery" value={money(sale.deliveryCost)} />
              <TotalLine label="Labour" value={money(sale.labourCost)} />
              <TotalLine label="Less" value={`-${money(sale.lessTaka)}`} />
              <TotalLine
                label="Customer Advance"
                value={`-${money(sale.customerAdvancePaymentAdjust)}`}
              />
              {(sale.return ?? 0) > 0 && (
                <TotalLine label="Return" value={money(sale.return)} />
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 mt-2 pt-2">
                <TotalLine label="Total" value={money(sale.payable)} bold />
              </div>
              <TotalLine label="Paid" value={money(sale.paid)} bold />
              {sale.changes > 0 && (
                <TotalLine label="Change" value={money(sale.changes)} />
              )}

              <div className="border-t border-gray-100 dark:border-gray-800 mt-2 pt-2">
                <TotalLine
                  label="Present Due"
                  value={money(sale.presentDue)}
                  tone={sale.presentDue > 0 ? "red" : undefined}
                />
              </div>
              <TotalLine
                label="Previous Due"
                value={money(sale.previousDue)}
                tone={sale.previousDue > 0 ? "red" : undefined}
              />

              <div className="border-t border-gray-100 dark:border-gray-800 mt-2 pt-2">
                <TotalLine
                  label="Total Due"
                  value={money(sale.balance)}
                  bold
                  tone={sale.balance > 0 ? "red" : "green"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ---------- Table bits ----------
const Th = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <th
    className={`px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center ${className}`}
  >
    {children}
  </th>
);

const Td = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <td
    className={`px-4 py-3 text-xs text-center text-gray-600 dark:text-gray-300 ${className}`}
  >
    {children}
  </td>
);

export default SalesView;
