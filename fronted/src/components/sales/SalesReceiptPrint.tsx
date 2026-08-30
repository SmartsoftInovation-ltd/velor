import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import html2canvas from "html2canvas";
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

interface StoreInformation {
  storeName: string;
  propiterSlogan?: string;
  adress: string;
  phone: string;
  email?: string;
  footer?: string;
  image?: { url?: string };
}

interface SearchItem {
  barcode?: string;
  productDescription?: string;
  color?: string;
  size?: string;
  quantity?: number;
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
  remark?: string;
  searchItem: SearchItem[];
  customerType: {
    type: "listed" | "walking";
    walking?: { customerName?: string; mobileNumber?: string } | null;
    customerId?: { fullName?: string; mobileNumber?: string } | null;
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

// ── Settings ───────────────────────────────────────────────────────────────
interface ReceiptSettings {
  narrowPaper: boolean;
  autoPrint: boolean;
  showLogo: boolean;
  showStoreTitle: boolean;
  showCashier: boolean;
  showItemDetails: boolean;
  showBarcodes: boolean;
  showPreviousDue: boolean;
  showBarcode: boolean;
  showCutLine: boolean;
  showRemarks: boolean;
}

const DEFAULT_SETTINGS: ReceiptSettings = {
  narrowPaper: false,
  autoPrint: false,
  showLogo: true,
  showStoreTitle: true,
  showCashier: true,
  showItemDetails: true,
  showBarcodes: true,
  showPreviousDue: true,
  showBarcode: true,
  showCutLine: true,
  showRemarks: true,
};

const SETTINGS_KEY = "receipt-settings";

const loadSettings = (): ReceiptSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const money = (n = 0) =>
  `৳ ${Math.round(Number(n || 0)).toLocaleString("en-US")}`;

const SalesReceiptPrint = () => {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ReceiptSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "image" | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const autoPrintedRef = useRef(false);

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

  const update = <K extends keyof ReceiptSettings>(
    key: K,
    value: ReceiptSettings[K],
  ) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // storage full or blocked — settings still apply for this session
      }
      return next;
    });
  };

  useEffect(() => {
    if (barcodeRef.current && sale?.invoiceNumber && settings.showBarcode) {
      renderBarcodeToSvg(barcodeRef.current, sale.invoiceNumber, {
        width: 1.4,
        height: 45,
        displayValue: false,
      });
      // A long invoice number renders wider than the paper, which clips the
      // right-hand bars on a POS printer; scale it down to the space it has,
      // holding back a sliver on each side for the printer's edge tolerance.
      fitBarcodeSvgToWidth(barcodeRef.current, 0, BARCODE_EDGE_INSET_PX);
    }
    // narrowPaper changes the receipt width, so the barcode has to be re-fitted
    // to the new paper rather than keeping the previous size.
  }, [sale?.invoiceNumber, settings.showBarcode, settings.narrowPaper]);

  // Auto-print once per load when the cashier has enabled it.
  useEffect(() => {
    if (settings.autoPrint && sale && !autoPrintedRef.current) {
      autoPrintedRef.current = true;
      const t = window.setTimeout(() => window.print(), 400);
      return () => window.clearTimeout(t);
    }
  }, [settings.autoPrint, sale]);

  // Rasterise the receipt once, then hand the bitmap to whichever exporter
  // asked for it — html2canvas is the slow part, so both paths share it.
  const snapshot = async () => {
    if (!receiptRef.current) return null;
    return html2canvas(receiptRef.current, {
      scale: 3,
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
      link.download = `receipt-${sale.invoiceNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Receipt image downloaded");
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

      // A till roll has no fixed page height — size the page to the receipt so
      // the PDF is one continuous slip, not an A4 sheet with a strip on top.
      const widthMm = settings.narrowPaper ? 58 : 80;
      const heightMm = (canvas.height * widthMm) / canvas.width;
      const pdf = new jsPDF({ unit: "mm", format: [widthMm, heightMm] });
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        0,
        widthMm,
        heightMm,
      );
      pdf.save(`receipt-${sale.invoiceNumber}.pdf`);
      toast.success("Receipt PDF downloaded");
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
          Failed to load receipt!
        </p>
      </div>
    );

  const ct = sale.customerType;
  const customerName =
    ct?.type === "listed" ? ct.customerId?.fullName : ct?.walking?.customerName;
  const customerMobile =
    ct?.type === "listed"
      ? ct.customerId?.mobileNumber
      : ct?.walking?.mobileNumber;

  const salesmanName = sale.salesMen?.fullName;
  const salesmanId = sale.salesMen?.employeeId;

  // The logged-in user who rang the sale is recorded as discountGivenBy —
  // that is the closest thing to a cashier the sale carries.
  const cashierName = sale.discountGivenBy?.name;

  // Date and time come from different fields: `date` is the day the cashier
  // picked, `createdAt` is when the sale was actually rung up.
  const dateTime = `${moment(sale.date).format("DD MMM YYYY")}${
    sale.createdAt ? ` ${moment(sale.createdAt).format("hh:mm:ss A")}` : ""
  }`;

  const items = sale.searchItem || [];
  const itemCount = items.reduce((n, i) => n + (i.quantity || 0), 0);
  const discountAmt = (sale.total * (sale.discountPercent || 0)) / 100;
  const vatAmt = ((sale.total - discountAmt) * (sale.vatPercent || 0)) / 100;

  const advanceAdjust = sale.customerAdvancePaymentAdjust || 0;

  // Rounded to match how the value is printed — a previous due of 0.4 shows
  // as ৳ 0, so it should not pull the Previous/Total Due rows onto the slip.
  const hasPreviousDue = Math.round(Number(sale.previousDue) || 0) !== 0;

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

  const width = settings.narrowPaper ? "58mm" : "80mm";

  return (
    <div
      id="receipt-page"
      className="min-h-screen bg-gray-200 dark:bg-gray-950 py-6"
    >
      <style>{`
        @media print {
          @page { size: ${width} auto; margin: 0; }
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden; }
          #printable-receipt, #printable-receipt * { visibility: visible; }
          /* Thermal heads are 1-bit: any grey is dithered into sparse dots and
             reads as blurry. Force every glyph and rule to solid black on white
             so the printer fires a full dot instead. */
          #printable-receipt, #printable-receipt * {
            color: #000 !important;
            border-color: #000 !important;
            background: transparent !important;
            opacity: 1 !important;
            text-shadow: none !important;
            -webkit-font-smoothing: none !important;
          }
          #printable-receipt { background: #fff !important; }
          /* The logo is the one element that keeps its own colours. */
          #printable-receipt img { filter: none !important; opacity: 1 !important; }
          #printable-receipt {
            position: absolute !important;
            top: 0 !important;
            /* Centred rather than pinned left: on a page wider than the roll
               (A4 preview, PDF export) a left-pinned receipt hugs the edge. */
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: ${width} !important;
            margin: 0 !important;
            box-shadow: none !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex justify-center gap-2 mb-5 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 text-xs font-bold shadow-lg transition-colors"
        >
          <FiArrowLeft className="size-3.5" />
          Back
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold shadow-lg transition-colors"
        >
          <FiSettings className="size-3.5" />
          Settings
        </button>
        <button
          onClick={handleDownloadPdf}
          disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 disabled:bg-gray-500 disabled:cursor-not-allowed text-[#1D4ED8] text-xs font-bold shadow-lg transition-colors"
        >
          <FiFileText className="size-3.5" />
          {busy === "pdf" ? "Saving…" : "PDF"}
        </button>
        <button
          onClick={handleDownloadImage}
          disabled={busy !== null}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 disabled:bg-gray-500 disabled:cursor-not-allowed text-[#1D4ED8] text-xs font-bold shadow-lg transition-colors"
        >
          <FiImage className="size-3.5" />
          {busy === "image" ? "Saving…" : "Image"}
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold shadow-lg transition-colors"
        >
          <FiPrinter className="size-3.5" />
          Print
        </button>
      </div>

      {/* Receipt */}
      <div className="flex justify-center">
        <div
          id="printable-receipt"
          ref={receiptRef}
          style={{ width }}
          className="bg-white text-black px-4 py-5 shadow-lg font-mono"
        >
          {/* Store header */}
          <div className="text-center">
            {settings.showLogo && storeInfo?.image?.url && (
              <img
                src={storeInfo.image.url}
                alt="logo"
                crossOrigin="anonymous"
                className="size-12 mx-auto mb-2 object-contain"
              />
            )}
            {settings.showStoreTitle && (
              <h1 className="text-base font-bold leading-tight">
                {storeInfo?.storeName || "Store"}
              </h1>
            )}
            {storeInfo?.adress && (
              <p className="text-[9px] mt-1">{storeInfo.adress}</p>
            )}
            {storeInfo?.phone && (
              <p className="text-[9px]">Tel: {storeInfo.phone}</p>
            )}
          </div>

          <Divider />

          <div className="text-center">
            <p className="text-[10px] font-bold tracking-wide">SALES RECEIPT</p>
            <p className="text-sm font-bold mt-0.5">{sale.invoiceNumber}</p>
          </div>

          <Divider />

          {/* Meta — date and time kept on one line */}
          <div className="text-[9px]">
            <MetaRow label="Date:" value={dateTime} />
          </div>

          {/* Customer / Cashier / Salesmen — three columns side by side */}
          <div className="border border-black mt-2 px-2 py-1.5">
            <div className="flex">
              <div className="flex-1 min-w-0 pr-1.5">
                <p className="text-[8px] font-bold tracking-wide">
                  CUSTOMER
                </p>
                <p className="text-[9px] font-bold truncate">
                  {customerName || "Walking Customer"}
                </p>
                {customerMobile && (
                  <p className="text-[8px] truncate">
                    {customerMobile}
                  </p>
                )}
              </div>

              {settings.showCashier && (
                <>
                  <div className="border-l border-dashed border-black" />
                  <div className="flex-1 min-w-0 px-1.5">
                    <p className="text-[8px] font-bold tracking-wide">
                      CASHIER
                    </p>
                    <p className="text-[9px] font-bold truncate">
                      {cashierName || "—"}
                    </p>
                  </div>
                </>
              )}

              <div className="border-l border-dashed border-black" />
              <div className="flex-1 min-w-0 pl-1.5">
                <p className="text-[8px] font-bold tracking-wide">
                  SALESMEN
                </p>
                <p className="text-[9px] font-bold truncate">
                  {salesmanName || "—"}
                </p>
                {salesmanId && (
                  <p className="text-[8px] truncate">
                    {salesmanId}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="flex justify-between text-[9px] font-bold mt-3 pb-1 border-b border-black">
            <span>PRODUCT DESCRIPTION</span>
            <span className="flex gap-4">
              <span>QTY</span>
              <span>AMOUNT</span>
            </span>
          </div>

          {items.map((item, i) => (
            <div
              key={i}
              className="py-1.5 border-b border-dashed border-black"
            >
              <div className="flex justify-between gap-2">
                <span className="text-[10px] font-bold flex-1">
                  {item.productDescription || "—"}
                </span>
                <span className="text-[10px] w-6 text-right">
                  {item.quantity ?? 0}
                </span>
                <span className="text-[10px] w-16 text-right font-bold">
                  {money(item.subtotal)}
                </span>
              </div>
              {settings.showItemDetails && (
                <>
                  <p className="text-[8px]">
                    {item.quantity ?? 0} × {money(item.salesRate)}
                    {item.unit ? ` ${item.unit}` : ""}
                  </p>
                  {(item.color || item.size) && (
                    <p className="text-[8px]">
                      {[
                        item.color ? `Color: ${item.color}` : null,
                        item.size ? `Size: ${item.size}` : null,
                      ]
                        .filter(Boolean)
                        .join(" | ")}
                    </p>
                  )}
                </>
              )}
              {settings.showBarcodes && item.barcode && (
                <p className="text-[8px]">S/N: {item.barcode}</p>
              )}
            </div>
          ))}

          {items.length === 0 && (
            <p className="text-[9px] text-center py-3">
              No items on this receipt.
            </p>
          )}

          {/* Totals */}
          <div className="mt-2 text-[10px] space-y-1">
            <TotalRow
              label={`Subtotal (${itemCount} item${itemCount === 1 ? "" : "s"})`}
              value={money(sale.total)}
            />
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
            {Math.round(advanceAdjust) !== 0 && (
              <TotalRow
                label="Customer Advance"
                value={`-${money(advanceAdjust)}`}
              />
            )}
          </div>

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-black">
            <span className="text-sm font-bold">Total</span>
            <span className="text-sm font-bold">{money(sale.payable)}</span>
          </div>

          <div className="mt-1.5 text-[10px] space-y-1">
            <div className="flex justify-between font-bold">
              <span>Paid</span>
              <span>{money(sale.paid)}</span>
            </div>

            {settings.showPreviousDue && (
              <>
                <div className="border-t border-black pt-1">
                  <TotalRow
                    label="Present Due"
                    value={money(sale.presentDue)}
                  />
                </div>
                {/* Previous Due only matters when the customer carried a
                    balance in — with nothing owed before, it and the combined
                    Total Due just repeat Present Due. */}
                {hasPreviousDue && (
                  <>
                    <TotalRow
                      label="Previous Due"
                      value={money(sale.previousDue)}
                    />
                    <div className="flex justify-between font-bold border-t border-black pt-1">
                      <span>Total Due</span>
                      <span>{money(sale.balance)}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Payment — kept directly above the barcode */}
          <div className="border border-black mt-3 px-2 py-1.5">
            <p className="text-[8px] font-bold tracking-wide mb-1">PAYMENT</p>
            {payments.map((p, i) => (
              <div key={i} className="flex justify-between text-[9px]">
                <span>{accountName(p)}</span>
                <span>{money(p.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-[10px] font-bold border-t border-dashed border-black mt-1 pt-1">
              <span>Total Paid</span>
              <span>{money(sale.paid)}</span>
            </div>
            {sale.changes > 0 && (
              <div className="flex justify-between text-[9px]">
                <span>Change</span>
                <span>{money(sale.changes)}</span>
              </div>
            )}
          </div>

          {/* Barcode */}
          {settings.showBarcode && (
            <div className="mt-4 text-center">
              <svg ref={barcodeRef} className="mx-auto max-w-full" />
              <p className="text-[9px] tracking-widest mt-0.5">
                {sale.invoiceNumber}
              </p>
            </div>
          )}

          {settings.showCutLine && <Divider />}

          {/* Footer */}
          {settings.showRemarks && (sale.remark || storeInfo?.footer) && (
            <div className="text-center text-[9px] mt-2">
              {sale.remark && <p className="font-bold mb-1">{sale.remark}</p>}
              {storeInfo?.footer && (
                <p className="font-bold leading-snug">{storeInfo.footer}</p>
              )}
            </div>
          )}

          <p className="text-center text-[8px] font-bold mt-3 pt-2 border-t border-black">
            Powered By Smartsoft Innovation | 01999878862
          </p>
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
                Receipt Settings
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
                Print Options
              </p>
              <Toggle
                label="Paper Width 58mm"
                checked={settings.narrowPaper}
                onChange={(v) => update("narrowPaper", v)}
              />
              <Toggle
                label="Auto Print on Load"
                checked={settings.autoPrint}
                onChange={(v) => update("autoPrint", v)}
              />

              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mt-5 mb-2">
                Show / Hide Elements
              </p>
              <Toggle
                label="Logo"
                checked={settings.showLogo}
                onChange={(v) => update("showLogo", v)}
              />
              <Toggle
                label="Store Title"
                checked={settings.showStoreTitle}
                onChange={(v) => update("showStoreTitle", v)}
              />
              <Toggle
                label="Cashier Name"
                checked={settings.showCashier}
                onChange={(v) => update("showCashier", v)}
              />
              <Toggle
                label="Item Details (Price × Qty)"
                checked={settings.showItemDetails}
                onChange={(v) => update("showItemDetails", v)}
              />
              <Toggle
                label="Serial Numbers"
                checked={settings.showBarcodes}
                onChange={(v) => update("showBarcodes", v)}
              />
              <Toggle
                label="Previous Due Info"
                checked={settings.showPreviousDue}
                onChange={(v) => update("showPreviousDue", v)}
              />
              <Toggle
                label="Barcode"
                checked={settings.showBarcode}
                onChange={(v) => update("showBarcode", v)}
              />
              <Toggle
                label="Cut Line"
                checked={settings.showCutLine}
                onChange={(v) => update("showCutLine", v)}
              />
              <Toggle
                label="Remarks/Notes"
                checked={settings.showRemarks}
                onChange={(v) => update("showRemarks", v)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Bits ───────────────────────────────────────────────────────────────────
const Divider = () => (
  <div className="border-t border-dashed border-black my-2" />
);

const MetaRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <span>{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

const TotalRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between">
    <span>{label}</span>
    <span>{value}</span>
  </div>
);

const Toggle = ({
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
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked
          ? "bg-gray-800 dark:bg-gray-200"
          : "bg-gray-200 dark:bg-gray-600"
      }`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-white dark:bg-gray-800 shadow transition-all ${
          checked ? "left-5.5" : "left-0.5"
        }`}
      />
    </button>
  </div>
);

export default SalesReceiptPrint;
