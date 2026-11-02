import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import toast from "react-hot-toast";
import {
  FiArrowLeft,
  FiSettings,
  FiFileText,
  FiImage,
  FiPrinter,
  FiX,
} from "react-icons/fi";
import axiosSecure from "../../hooks/useAxiosSecure";
import {
  renderBarcodeToSvg,
  fitBarcodeSvgToWidth,
  BARCODE_EDGE_INSET_PX,
} from "../../utils/barcodeRender";
import { scopedStorageKey } from "../../lib/session";

interface StoreInformation {
  storeName: string;
  propiterSlogan?: string;
  adress: string;
  phone: string;
  email?: string;
  websiteLink?: string;
  footer?: string;
  image?: { url?: string };
}

interface SearchItem {
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

interface Sale {
  _id: string;
  invoiceNumber: string;
  date: string;
  // Set by mongoose timestamps — the only field carrying the real sale time,
  // since `date` holds just the day the cashier picked.
  createdAt?: string;
  salesType: string;
  invoiceStatus: string;
  paymentStatus: string;
  remark?: string;
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
      fullName?: string;
      mobileNumber?: string;
      emailAddress?: string;
      presentAddress?: string;
    } | null;
  };
  salesMen?: { fullName?: string; employeeId?: string; email?: string } | null;
  discountGivenBy?: { name?: string; email?: string } | null;
  total: number;
  discountPercent: number;
  vatPercent: number;
  deliveryCost: number;
  labourCost: number;
  lessTaka: number;
  customerAdvancePaymentAdjust: number;
  payable: number;
  paid: number;
  changes: number;
  // Cash the shop actually kept: paid - changes. Stored server-side so it can
  // never drift from the two fields above.
  netPaid: number;
  presentDue: number;
  previousDue: number;
  balance: number;
  paymentMethod?: {
    singlePayment?: {
      amount?: number;
      paymentTo?: { name?: string } | string;
    } | null;
    multiplePayment?: {
      amount?: number;
      paymentTo?: { name?: string } | string;
    }[];
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

// ── Settings ───────────────────────────────────────────────────────────────
interface InvoiceSettings {
  letterhead: boolean;
  pageSize: "A4" | "A5";
  showCompanyHeader: boolean;
  showCashier: boolean;
  showItemDetails: boolean;
  showColorSize: boolean;
  showSerial: boolean;
  showRemarks: boolean;
  showTerms: boolean;
  showSignatures: boolean;
}

const DEFAULT_SETTINGS: InvoiceSettings = {
  letterhead: false,
  pageSize: "A4",
  showCompanyHeader: true,
  showCashier: true,
  showItemDetails: true,
  showColorSize: true,
  showSerial: false,
  showRemarks: true,
  showTerms: true,
  showSignatures: true,
};

// Per store: each store chooses its own letterhead and page size.
const invoiceSettingsKey = () => scopedStorageKey("invoice-settings");

const loadSettings = (): InvoiceSettings => {
  try {
    const raw = localStorage.getItem(invoiceSettingsKey());
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const SalesInvoicePrint = () => {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const navigate = useNavigate();
  const barcodeRef = useRef<SVGSVGElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<InvoiceSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "image" | null>(null);

  const update = <K extends keyof InvoiceSettings>(
    key: K,
    value: InvoiceSettings[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(invoiceSettingsKey(), JSON.stringify(next));
      } catch {
        // storage full or blocked — settings still apply for this session
      }
      return next;
    });
  };

  const {
    data: sale,
    isLoading,
    isError,
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

  const { data: storeInfo } = useQuery<StoreInformation | null>({
    queryKey: ["store-information"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get(
          "/storeinformation/store-information",
        );
        return data.data.stores?.[0] || null;
      } catch {
        return null;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (barcodeRef.current && sale?.invoiceNumber) {
      renderBarcodeToSvg(barcodeRef.current, sale.invoiceNumber, {
        width: 1.3,
        height: 38,
        displayValue: false,
      });
      // A long invoice number renders wider than the paper, which clips the
      // right-hand bars on a POS printer; scale it down to the space it has,
      // holding back a sliver on each side for the printer's edge tolerance.
      fitBarcodeSvgToWidth(barcodeRef.current, 0, BARCODE_EDGE_INSET_PX);
    }
  }, [sale?.invoiceNumber]);

  // Rasterise the invoice card once, then hand the bitmap to whichever exporter
  // asked for it — html2canvas is the slow part, so both paths share it.
  const snapshot = async () => {
    if (!invoiceRef.current) return null;
    return html2canvas(invoiceRef.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
  };

  const handleDownloadImage = async () => {
    if (!sale) return;
    setBusy("image");
    try {
      const canvas = await snapshot();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `invoice-${sale.invoiceNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Invoice image downloaded");
    } catch {
      toast.error("Could not generate the image.");
    } finally {
      setBusy(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!sale) return;
    setBusy("pdf");
    try {
      const canvas = await snapshot();
      if (!canvas) return;

      const pdf = new jsPDF({
        unit: "mm",
        format: settings.pageSize.toLowerCase(),
      });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const img = canvas.toDataURL("image/png");

      // Taller than one page: slice it across pages instead of squashing.
      if (imgH <= pageH) {
        pdf.addImage(img, "PNG", 0, 0, pageW, imgH);
      } else {
        let remaining = imgH;
        let offset = 0;
        while (remaining > 0) {
          pdf.addImage(img, "PNG", 0, -offset, pageW, imgH);
          remaining -= pageH;
          offset += pageH;
          if (remaining > 0) pdf.addPage();
        }
      }

      pdf.save(`invoice-${sale.invoiceNumber}.pdf`);
      toast.success("Invoice PDF downloaded");
    } catch {
      toast.error("Could not generate the PDF.");
    } finally {
      setBusy(null);
    }
  };

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
          Failed to load invoice!
        </p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl font-bold text-sm"
        >
          Go Back
        </button>
      </div>
    );

  const ct = sale.customerType;
  const customerName =
    ct?.type === "listed" ? ct.customerId?.fullName : ct?.walking?.customerName;
  const customerMobile =
    ct?.type === "listed"
      ? ct.customerId?.mobileNumber
      : ct?.walking?.mobileNumber;
  const customerAddress =
    ct?.type === "listed"
      ? ct.customerId?.presentAddress
      : ct?.walking?.address;

  const salesmanName = sale.salesMen?.fullName;
  const salesmanId = sale.salesMen?.employeeId;
  const salesmanEmail = sale.salesMen?.email;

  // The logged-in user who rang the sale is recorded as discountGivenBy —
  // that is the closest thing to a cashier the sale carries.
  const cashierName = sale.discountGivenBy?.name;
  const cashierEmail = sale.discountGivenBy?.email;

  const items = sale.searchItem || [];

  // Print the cash the shop kept, not the note the customer handed over.
  // `netPaid` is written server-side on every save; sales recorded before that
  // field existed fall back to the same subtraction it stores.
  const paidNet =
    sale.netPaid ?? Math.max(0, (sale.paid || 0) - (sale.changes || 0));

  const discountAmt = (sale.total * (sale.discountPercent || 0)) / 100;
  const vatAmt = ((sale.total - discountAmt) * (sale.vatPercent || 0)) / 100;

  // Every payment on the sale, regardless of which slot it was stored in —
  // single and multiple are just storage shapes, not a distinction worth
  // printing, and a sale can carry both.
  const payments = [
    ...(sale.paymentMethod?.singlePayment
      ? [sale.paymentMethod.singlePayment]
      : []),
    ...(sale.paymentMethod?.multiplePayment ?? []),
  ].filter((p) => p && (p.amount ?? 0) > 0);

  const accountName = (p: { paymentTo?: { name?: string } | string }) =>
    typeof p.paymentTo === "object" && p.paymentTo?.name
      ? p.paymentTo.name
      : "Cash";
  const paymentLabel = payments.length
    ? [...new Set(payments.map(accountName))].join(", ")
    : "—";

  return (
    <div
      id="print-page-wrap"
      className="min-h-screen bg-gray-200 dark:bg-gray-950 py-6 print:bg-white print:py-0"
    >
      <style>{`
        @media print {
          @page { size: ${settings.pageSize}; margin: 10mm; }
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          #print-page-wrap { min-height: 0 !important; height: auto !important; }
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          /* Mono output: mid-greys at 8-9px print washed out and read blurry,
             so text is forced solid black. Borders and fills are deliberately
             left alone — the light hairlines and banded headers carry the
             layout, and blackening them turns the table into a heavy grid. */
          #printable-invoice, #printable-invoice * {
            color: #000 !important;
            opacity: 1 !important;
            text-shadow: none !important;
            /* Browsers drop background fills when printing unless told not to;
               the header/Terms bands are fills, so they must be kept. */
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Reversed-out elements must stay white-on-black, not black-on-black. */
          #printable-invoice .print-invert,
          #printable-invoice .print-invert * { color: #fff !important; }
          /* The logo keeps its own colours. */
          #printable-invoice img { filter: none !important; opacity: 1 !important; }
          #printable-invoice {
            position: absolute !important;
            top: 0 !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="max-w-3xl mx-auto px-6 mb-4 flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 text-xs font-bold shadow transition-colors"
        >
          <FiArrowLeft className="size-3.5" />
          Back
        </button>

        <div className="flex gap-2">
          <ToolbarButton
            icon={<FiSettings className="size-3.5" />}
            onClick={() => setShowSettings(true)}
          >
            Settings
          </ToolbarButton>
          <ToolbarButton
            icon={<FiFileText className="size-3.5" />}
            onClick={handleDownloadPdf}
            disabled={busy !== null}
          >
            {busy === "pdf" ? "Saving…" : "PDF"}
          </ToolbarButton>
          <ToolbarButton
            icon={<FiImage className="size-3.5" />}
            onClick={handleDownloadImage}
            disabled={busy !== null}
          >
            {busy === "image" ? "Saving…" : "Image"}
          </ToolbarButton>
          <ToolbarButton
            icon={<FiPrinter className="size-3.5" />}
            onClick={() => window.print()}
          >
            Print
          </ToolbarButton>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6">
        <div
          id="printable-invoice"
          ref={invoiceRef}
          className="bg-white text-black px-8 py-7 shadow-lg print:shadow-none print:px-0"
        >
          {/* Header — skipped entirely on pre-printed letterhead */}
          {!settings.letterhead && settings.showCompanyHeader && (
            <div className="flex items-start justify-between">
              {storeInfo?.image?.url ? (
                <img
                  src={storeInfo.image.url}
                  alt="logo"
                  crossOrigin="anonymous"
                  className="size-16 object-contain"
                />
              ) : (
                <div />
              )}
              <div className="text-right">
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-800 leading-none">
                  INVOICE
                </h1>
                <p className="text-sm font-bold mt-1.5">
                  {storeInfo?.storeName || "Store"}
                </p>
                {storeInfo?.adress && (
                  <p className="text-[9px] text-black">{storeInfo.adress}</p>
                )}
                {storeInfo?.phone && (
                  <p className="text-[9px] text-black">
                    Tel: {storeInfo.phone}
                  </p>
                )}
                {/* Shown only when the store has set them. */}
                {storeInfo?.email && (
                  <p className="text-[9px] text-black">Email: {storeInfo.email}</p>
                )}
                {storeInfo?.websiteLink && (
                  <p className="text-[9px] text-black">Web: {storeInfo.websiteLink}</p>
                )}
              </div>
            </div>
          )}

          {settings.letterhead && <div className="h-24" />}

          <div className="border-t-2 border-black mt-4" />

          {/* Bill to / details / barcode */}
          <div className="grid grid-cols-[1.1fr_1.4fr_1fr] border border-gray-400 border-t-0">
            <div className="p-3">
              <p className="text-[8px] font-bold tracking-wide text-black mb-1.5">
                BILL TO
              </p>
              <p className="text-xs font-bold">
                {customerName || "Walking Customer"}
              </p>
              {customerMobile && (
                <p className="text-[9px] text-black mt-0.5">
                  Tel: {customerMobile}
                </p>
              )}
              {customerAddress && (
                <p className="text-[9px] text-black">{customerAddress}</p>
              )}

              <div className="flex mt-2 pt-2 border-t border-dashed border-gray-500">
                {settings.showCashier && (
                  <>
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-[8px] font-bold tracking-wide text-black">
                        CASHIER
                      </p>
                      <p className="text-[9px] font-bold truncate">
                        {cashierName || "—"}
                      </p>
                      <p className="text-[9px] text-black truncate">
                        {cashierEmail || "—"}
                      </p>
                    </div>

                    <div className="border-l border-dashed border-gray-500" />
                  </>
                )}

                <div className="flex-1 min-w-0 pl-2">
                  <p className="text-[8px] font-bold tracking-wide text-black">
                    SALESMEN
                  </p>
                  <p className="text-[9px] font-bold truncate">
                    {salesmanName || "—"}
                  </p>
                  {salesmanId && (
                    <p className="text-[9px] text-black truncate">
                      {salesmanId}
                    </p>
                  )}
                  {salesmanEmail && (
                    <p className="text-[9px] text-black truncate">
                      {salesmanEmail}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 border-l border-gray-400">
              <p className="text-[8px] font-bold tracking-wide text-black mb-1.5">
                INVOICE DETAILS
              </p>
              <DetailRow
                label="Date:"
                value={`${moment(sale.date).format("DD/MM/YYYY")}${
                  sale.createdAt
                    ? ` ${moment(sale.createdAt).format("hh:mm A")}`
                    : ""
                }`}
              />
              <DetailRow
                label="Sale Type:"
                value={salesTypeLabel[sale.salesType] || sale.salesType}
              />
              <DetailRow label="Payment:" value={paymentLabel} />
              <div className="flex justify-between items-center gap-2 mt-1">
                <span className="text-[9px] text-black">Sale Status:</span>
                <StatusPill value={sale.invoiceStatus} />
              </div>
              <div className="flex justify-between items-center gap-2 mt-1">
                <span className="text-[9px] text-black">Pay Status:</span>
                <StatusPill value={sale.paymentStatus} />
              </div>
            </div>

            <div className="p-3 border-l border-gray-400 flex flex-col items-center justify-center">
              <p className="text-[8px] font-bold tracking-wide text-black mb-1.5">
                INVOICE NO
              </p>
              <svg ref={barcodeRef} className="max-w-full" />
              <p className="text-[10px] font-bold tracking-widest mt-0.5">
                {sale.invoiceNumber}
              </p>
            </div>
          </div>

          {/* Items */}
          <table className="w-full border-collapse mt-4">
            <thead>
              <tr className="bg-gray-50 text-gray-800 border-b border-gray-300">
                <th className="px-3 py-2.5 text-left text-[9px] font-bold tracking-wide w-8">
                  #
                </th>
                <th className="px-3 py-2.5 text-left text-[9px] font-bold tracking-wide">
                  PRODUCT DESCRIPTION
                </th>
                <th className="px-3 py-2.5 text-right text-[9px] font-bold tracking-wide w-20">
                  QTY
                </th>
                <th className="px-3 py-2.5 text-right text-[9px] font-bold tracking-wide w-24">
                  PRICE
                </th>
                <th className="px-3 py-2.5 text-right text-[9px] font-bold tracking-wide w-24">
                  AMOUNT
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="px-3 py-2.5 text-[9px] text-gray-800 align-top">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <p className="text-[10px] font-bold text-black">
                      {item.productDescription || "—"}
                      {item.barcode && (
                        <span className="font-normal text-gray-800">
                          {" "}
                          | {item.barcode}
                        </span>
                      )}
                    </p>
                    {settings.showItemDetails && (
                      <p className="text-[8px] text-gray-800">
                        {item.quantity ?? 0} × {money(item.salesRate)}
                        {item.unit ? ` ${item.unit}` : ""}
                      </p>
                    )}
                    {settings.showColorSize && (item.color || item.size) && (
                      <p className="text-[8px] text-gray-800">
                        {[
                          item.color ? `Color: ${item.color}` : null,
                          item.size ? `Size: ${item.size}` : null,
                        ]
                          .filter(Boolean)
                          .join(" | ")}
                      </p>
                    )}
                    {settings.showSerial && item.barcode && (
                      <p className="text-[8px] text-gray-800">
                        S/N: {item.barcode}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[9px] text-black align-top">
                    {item.quantity ?? 0}
                    {item.unit ? ` ${item.unit}` : ""}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[10px] align-top">
                    {money(item.salesRate)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[10px] font-bold align-top">
                    {money(item.subtotal)}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-2 py-6 text-center text-[10px] text-gray-800"
                  >
                    No items on this invoice.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Payment breakdown + totals */}
          <div className="grid grid-cols-2 gap-6 mt-5">
            <div>
              <div className="border border-gray-500 rounded-sm px-3 py-2">
                <p className="text-[8px] font-bold tracking-wide text-gray-800 mb-1.5">
                  PAYMENT
                </p>
                {payments.length === 0 ? (
                  <p className="text-[9px] text-gray-800">
                    No payment recorded.
                  </p>
                ) : (
                  payments.map((p, i) => (
                    <div
                      key={i}
                      className="flex justify-between text-[9px] text-black"
                    >
                      <span>{accountName(p)}</span>
                      <span>{money(p.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-[10px] font-bold text-black border-t border-dashed border-black mt-1.5 pt-1.5">
                  <span>Total Paid</span>
                  <span>{money(paidNet)}</span>
                </div>
              </div>

              {settings.showRemarks && sale.remark && (
                <div className="border border-gray-400 rounded-sm p-3 mt-3">
                  <p className="text-[8px] font-bold tracking-wide text-black mb-1">
                    REMARKS &amp; NOTES
                  </p>
                  <p className="text-[9px] text-gray-800">{sale.remark}</p>
                </div>
              )}
            </div>

            <div className="text-[10px] space-y-1.5">
              <TotalRow label="Subtotal" value={money(sale.total)} />
              {Math.round(discountAmt) !== 0 && (
                <TotalRow
                  label={`Discount (${sale.discountPercent || 0}%)`}
                  value={`-${money(discountAmt)}`}
                />
              )}
              {Math.round(vatAmt) !== 0 && (
                <TotalRow
                  label={`VAT (${sale.vatPercent || 0}%)`}
                  value={money(vatAmt)}
                />
              )}
              {Math.round(sale.deliveryCost || 0) !== 0 && (
                <TotalRow label="Delivery" value={money(sale.deliveryCost)} />
              )}
              {Math.round(sale.labourCost || 0) !== 0 && (
                <TotalRow label="Labour" value={money(sale.labourCost)} />
              )}
              {Math.round(sale.lessTaka || 0) !== 0 && (
                <TotalRow label="Less" value={`-${money(sale.lessTaka)}`} />
              )}
              {Math.round(sale.customerAdvancePaymentAdjust || 0) !== 0 && (
                <TotalRow
                  label="Customer Advance"
                  value={`-${money(sale.customerAdvancePaymentAdjust)}`}
                />
              )}

              <div className="flex justify-between items-center bg-gray-200 px-2.5 py-2 rounded-sm">
                <span className="text-[11px] font-bold text-black">
                  Total
                </span>
                <span className="text-[11px] font-bold text-black">
                  {money(sale.payable)}
                </span>
              </div>

              <TotalRow label="Paid" value={money(paidNet)} bold />
              {sale.changes > 0 && (
                <TotalRow label="Change" value={money(sale.changes)} />
              )}

              <div className="border-t border-gray-500 pt-1.5">
                <TotalRow label="Present Due" value={money(sale.presentDue)} />
              </div>
              <TotalRow label="Previous Due" value={money(sale.previousDue)} />
              <div className="flex justify-between border-t border-gray-500 pt-1.5">
                <span className="font-bold">Total Due</span>
                <span className="font-bold">{money(sale.balance)}</span>
              </div>
            </div>
          </div>

          {/* Terms */}
          {settings.showTerms && (
            <div className="border-l-2 border-gray-700 bg-gray-50 px-3 py-2.5 mt-5">
              <p className="text-[9px] font-bold tracking-wide text-gray-800">
                TERMS &amp; CONDITIONS
              </p>
            </div>
          )}

          {/* Signatures */}
          {settings.showSignatures && (
            <div className="grid grid-cols-3 gap-6 mt-16 text-center">
              <div className="border-t border-black pt-1.5">
                <p className="text-[9px] tracking-wide text-gray-800">
                  CUSTOMER
                </p>
              </div>
              <div className="border-t border-black pt-1.5">
                <p className="text-[9px] font-bold tracking-wide text-gray-800">
                  {storeInfo?.storeName || "Store"}
                </p>
                <p className="text-[8px] text-black">PREPARED BY</p>
              </div>
              <div className="border-t border-black pt-1.5">
                <p className="text-[9px] tracking-wide text-gray-800">
                  AUTHORIZED
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-400 mt-6 pt-3 text-center">
            {storeInfo?.footer && (
              <p className="text-[9px] font-bold">{storeInfo.footer}</p>
            )}
            <p className="text-[8px] text-gray-800 mt-1.5">
              Powered By Smartsoft Innovation | 01999878862
            </p>
          </div>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 print:hidden"
          onClick={() => setShowSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h4 className="text-base font-bold text-gray-800 dark:text-white">
                Invoice Settings
              </h4>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <FiX className="size-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">
                Print Mode
              </p>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2.5">
                <div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Letterhead / Pad Mode
                  </p>
                  <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70">
                    Hide header for pre-printed paper
                  </p>
                </div>
                <Switch
                  checked={settings.letterhead}
                  onChange={(v) => update("letterhead", v)}
                />
              </div>

              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-5 mb-2">
                Page Size
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["A4", "A5"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => update("pageSize", size)}
                    className={`py-2 rounded-lg text-xs font-bold transition-colors ${
                      settings.pageSize === size
                        ? "bg-gray-800 text-white"
                        : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-200 border border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-5 mb-2">
                Show / Hide Elements
              </p>
              <ToggleRow
                label="Company Header"
                checked={settings.showCompanyHeader}
                onChange={(v) => update("showCompanyHeader", v)}
              />
              <ToggleRow
                label="Cashier"
                checked={settings.showCashier}
                onChange={(v) => update("showCashier", v)}
              />
              <ToggleRow
                label="Item Details (Qty × Price)"
                checked={settings.showItemDetails}
                onChange={(v) => update("showItemDetails", v)}
              />
              <ToggleRow
                label="Color / Size"
                checked={settings.showColorSize}
                onChange={(v) => update("showColorSize", v)}
              />
              <ToggleRow
                label="SKU / Serial Number"
                checked={settings.showSerial}
                onChange={(v) => update("showSerial", v)}
              />
              <ToggleRow
                label="Remarks & Notes"
                checked={settings.showRemarks}
                onChange={(v) => update("showRemarks", v)}
              />
              <ToggleRow
                label="Terms & Conditions"
                checked={settings.showTerms}
                onChange={(v) => update("showTerms", v)}
              />
              <ToggleRow
                label="Signatures"
                checked={settings.showSignatures}
                onChange={(v) => update("showSignatures", v)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Bits ───────────────────────────────────────────────────────────────────
const ToolbarButton = ({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 disabled:bg-gray-500 disabled:cursor-not-allowed text-white text-xs font-bold shadow transition-colors"
  >
    {icon}
    {children}
  </button>
);

const Switch = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <button
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
      checked ? "bg-gray-800 dark:bg-gray-200" : "bg-gray-200 dark:bg-gray-600"
    }`}
  >
    <span
      className={`absolute top-0.5 size-5 rounded-full bg-white dark:bg-gray-800 shadow transition-all ${
        checked ? "left-5.5" : "left-0.5"
      }`}
    />
  </button>
);

const ToggleRow = ({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
    <span className="text-xs text-gray-700 dark:text-gray-200">{label}</span>
    <Switch checked={checked} onChange={onChange} />
  </div>
);

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2">
    <span className="text-[9px] text-gray-700">{label}</span>
    <span className="text-[9px] font-bold text-right text-black">{value}</span>
  </div>
);

const TotalRow = ({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) => (
  <div className="flex justify-between">
    <span className="text-gray-700">{label}</span>
    <span className={`text-black ${bold ? "font-bold" : ""}`}>{value}</span>
  </div>
);

// Greyscale only — the invoice prints on mono thermal/laser, where colour
// either vanishes or muddies. Weight and fill carry the distinction instead.
const StatusPill = ({ value }: { value: string }) => {
  const good = ["paid", "complete"].includes(value?.toLowerCase());
  const warn = ["partial", "pending"].includes(value?.toLowerCase());
  return (
    <span
      className={`px-2 py-0.5 rounded-sm text-[8px] font-bold uppercase tracking-wide ${
        good
          ? "print-invert bg-black text-white"
          : warn
            ? "bg-gray-200 text-black border border-black"
            : "bg-white text-black border border-black"
      }`}
    >
      {value}
    </span>
  );
};

export default SalesInvoicePrint;
