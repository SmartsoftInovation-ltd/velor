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

// A challan is a goods-dispatch note, so it deliberately carries no rate,
// subtotal, discount or due — only what is being handed over.
interface SearchItem {
  barcode?: string;
  productDescription?: string;
  color?: string;
  size?: string;
  quantity?: number;
  groupQuantity?: number;
  // Populated — the sale item itself carries no SKU, so it is read from here.
  variantId?: { sku?: string; barCode?: string } | null;
  productId?: { name?: string } | null;
}

interface Sale {
  _id: string;
  invoiceNumber: string;
  date: string;
  deliveryDate?: string;
  // Set by mongoose timestamps — the only field carrying the real sale time,
  // since `date` holds just the day the cashier picked.
  createdAt?: string;
  salesType: string;
  invoiceStatus: string;
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
}

const salesTypeLabel: Record<string, string> = {
  wholesale: "Wholesale",
  retailsale: "Retail Sale",
  retailsaleorder: "Retail Sale Order",
  wholesaleorder: "Wholesale Order",
};

// ── Settings ───────────────────────────────────────────────────────────────
interface ChallanSettings {
  letterhead: boolean;
  pageSize: "A4" | "A5";
  showCompanyHeader: boolean;
  showCashier: boolean;
  showColorSize: boolean;
  showSerial: boolean;
  showRemarks: boolean;
  showReceivedNote: boolean;
  showSignatures: boolean;
}

const DEFAULT_SETTINGS: ChallanSettings = {
  letterhead: false,
  pageSize: "A4",
  showCompanyHeader: true,
  showCashier: true,
  showColorSize: true,
  showSerial: true,
  showRemarks: true,
  showReceivedNote: true,
  showSignatures: true,
};

const SETTINGS_KEY = "challan-settings";

const loadSettings = (): ChallanSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const SalesChallanPrint = () => {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>();
  const navigate = useNavigate();
  const barcodeRef = useRef<SVGSVGElement>(null);
  const challanRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<ChallanSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState<"pdf" | "image" | null>(null);

  const update = <K extends keyof ChallanSettings>(
    key: K,
    value: ChallanSettings[K],
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

  // Rasterise the challan card once, then hand the bitmap to whichever exporter
  // asked for it — html2canvas is the slow part, so both paths share it.
  const snapshot = async () => {
    if (!challanRef.current) return null;
    return html2canvas(challanRef.current, {
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
      link.download = `challan-${sale.invoiceNumber}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Challan image downloaded");
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

      pdf.save(`challan-${sale.invoiceNumber}.pdf`);
      toast.success("Challan PDF downloaded");
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
          Failed to load challan!
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

  // Placeholder UI — a sale records only salesMen, so there is no cashier
  // field to read. Point these at the real values once that API exists.
  const cashierName = "";
  const cashierEmail = "";

  const items = sale.searchItem || [];
  const totalQty = items.reduce((n, i) => n + (i.quantity || 0), 0);

  // #, product, barcode, qty — plus whichever optional columns are switched on.
  const colCount =
    4 + (settings.showSerial ? 1 : 0) + (settings.showColorSize ? 2 : 0);

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
          #printable-challan, #printable-challan * { visibility: visible; }
          #printable-challan {
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
          id="printable-challan"
          ref={challanRef}
          className="bg-white text-gray-700 px-8 py-7 shadow-lg print:shadow-none print:px-0"
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
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-600 leading-none">
                  DELIVERY CHALLAN
                </h1>
                <p className="text-sm font-bold mt-1.5">
                  {storeInfo?.storeName || "Store"}
                </p>
                {storeInfo?.adress && (
                  <p className="text-[9px] text-gray-500">{storeInfo.adress}</p>
                )}
                {storeInfo?.phone && (
                  <p className="text-[9px] text-gray-500">
                    Tel: {storeInfo.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {settings.letterhead && <div className="h-24" />}

          <div className="border-t-2 border-gray-400 mt-4" />

          {/* Deliver to / details / barcode */}
          <div className="grid grid-cols-[1.1fr_1.4fr_1fr] border border-gray-200 border-t-0">
            <div className="p-3">
              <p className="text-[8px] font-bold tracking-wide text-gray-500 mb-1.5">
                DELIVER TO
              </p>
              <p className="text-xs font-bold">
                {customerName || "Walking Customer"}
              </p>
              {customerMobile && (
                <p className="text-[9px] text-gray-500 mt-0.5">
                  Tel: {customerMobile}
                </p>
              )}
              {customerAddress && (
                <p className="text-[9px] text-gray-500">{customerAddress}</p>
              )}

              <div className="flex mt-2 pt-2 border-t border-dashed border-gray-300">
                {settings.showCashier && (
                  <>
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-[8px] font-bold tracking-wide text-gray-500">
                        CASHIER
                      </p>
                      <p className="text-[9px] font-bold truncate">
                        {cashierName || "—"}
                      </p>
                      <p className="text-[9px] text-gray-500 truncate">
                        {cashierEmail || "—"}
                      </p>
                    </div>

                    <div className="border-l border-dashed border-gray-300" />
                  </>
                )}

                <div className="flex-1 min-w-0 pl-2">
                  <p className="text-[8px] font-bold tracking-wide text-gray-500">
                    SALESMEN
                  </p>
                  <p className="text-[9px] font-bold truncate">
                    {salesmanName || "—"}
                  </p>
                  {salesmanId && (
                    <p className="text-[9px] text-gray-500 truncate">
                      {salesmanId}
                    </p>
                  )}
                  {salesmanEmail && (
                    <p className="text-[9px] text-gray-500 truncate">
                      {salesmanEmail}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 border-l border-gray-200">
              <p className="text-[8px] font-bold tracking-wide text-gray-500 mb-1.5">
                CHALLAN DETAILS
              </p>
              <DetailRow
                label="Date:"
                value={`${moment(sale.date).format("DD/MM/YYYY")}${
                  sale.createdAt
                    ? ` ${moment(sale.createdAt).format("hh:mm A")}`
                    : ""
                }`}
              />
              {sale.deliveryDate && (
                <DetailRow
                  label="Delivery Date:"
                  value={moment(sale.deliveryDate).format("DD/MM/YYYY")}
                />
              )}
              <DetailRow
                label="Sale Type:"
                value={salesTypeLabel[sale.salesType] || sale.salesType}
              />
              <DetailRow label="Total Items:" value={String(items.length)} />
              <DetailRow label="Total Qty:" value={String(totalQty)} />
              <div className="flex justify-between items-center gap-2 mt-1">
                <span className="text-[9px] text-gray-500">Sale Status:</span>
                <StatusPill value={sale.invoiceStatus} />
              </div>
            </div>

            <div className="p-3 border-l border-gray-200 flex flex-col items-center justify-center">
              <p className="text-[8px] font-bold tracking-wide text-gray-500 mb-1.5">
                CHALLAN NO
              </p>
              <svg ref={barcodeRef} className="max-w-full" />
              <p className="text-[10px] font-bold tracking-widest mt-0.5">
                {sale.invoiceNumber}
              </p>
            </div>
          </div>

          {/* Items — quantity only, no rate or amount */}
          <table className="w-full border-collapse mt-4">
            <thead>
              <tr className="bg-gray-500 text-white">
                <th className="px-2 py-1.5 text-left text-[9px] font-bold w-7">
                  #
                </th>
                <th className="px-2 py-1.5 text-left text-[9px] font-bold">
                  PRODUCT
                </th>
                <th className="px-2 py-1.5 text-center text-[9px] font-bold w-28">
                  BARCODE
                </th>
                {settings.showSerial && (
                  <th className="px-2 py-1.5 text-center text-[9px] font-bold w-20">
                    SKU
                  </th>
                )}
                {settings.showColorSize && (
                  <>
                    <th className="px-2 py-1.5 text-center text-[9px] font-bold w-24">
                      COLOR
                    </th>
                    <th className="px-2 py-1.5 text-center text-[9px] font-bold w-16">
                      SIZE
                    </th>
                  </>
                )}
                <th className="px-2 py-1.5 text-center text-[9px] font-bold w-14">
                  QTY
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="px-2 py-2 text-[9px] text-gray-500">
                    {i + 1}
                  </td>
                  <td className="px-2 py-2 text-[10px] font-bold">
                    {item.productDescription || item.productId?.name || "—"}
                  </td>
                  <td className="px-2 py-2 text-[9px] text-center text-gray-600">
                    {item.barcode || item.variantId?.barCode || "—"}
                  </td>
                  {settings.showSerial && (
                    <td className="px-2 py-2 text-[9px] text-center text-gray-600">
                      {item.variantId?.sku || "—"}
                    </td>
                  )}
                  {settings.showColorSize && (
                    <>
                      <td className="px-2 py-2 text-[9px] text-center text-gray-600">
                        {item.color || "—"}
                      </td>
                      <td className="px-2 py-2 text-[9px] text-center text-gray-600">
                        {item.size || "—"}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-2 text-[10px] font-bold text-center">
                    {item.quantity ?? 0}
                  </td>
                </tr>
              ))}

              {items.length === 0 && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-2 py-6 text-center text-[10px] text-gray-400"
                  >
                    No items on this challan.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100">
                <td
                  colSpan={colCount - 1}
                  className="px-2 py-2 text-[10px] font-bold"
                >
                  TOTAL
                </td>
                <td className="px-2 py-2 text-[10px] font-bold text-center">
                  {totalQty}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Remarks */}
          {settings.showRemarks && sale.remark && (
            <div className="border-l-2 border-gray-400 bg-gray-50 px-3 py-2 mt-5">
              <p className="text-[8px] font-bold tracking-wide text-gray-600">
                REMARKS
              </p>
              <p className="text-[9px] mt-0.5">{sale.remark}</p>
            </div>
          )}

          {/* Received note */}
          {settings.showReceivedNote && (
            <div className="border border-gray-200 px-3 py-2 mt-5">
              <p className="text-[8px] font-bold tracking-wide text-gray-600">
                RECEIVED IN GOOD CONDITION
              </p>
              <p className="text-[8px] text-gray-500 mt-0.5 leading-relaxed">
                Goods described above have been received in full and in good
                condition. This challan is a dispatch note only and is not a
                demand for payment.
              </p>
            </div>
          )}

          {/* Signatures */}
          {settings.showSignatures && (
            <div className="grid grid-cols-3 gap-6 mt-16 text-center">
              <div className="border-t border-gray-400 pt-1.5">
                <p className="text-[9px] tracking-wide text-gray-600">
                  RECEIVED BY
                </p>
              </div>
              <div className="border-t border-gray-400 pt-1.5">
                <p className="text-[9px] tracking-wide text-gray-600">
                  DELIVERED BY
                </p>
              </div>
              <div className="border-t border-gray-400 pt-1.5">
                <p className="text-[9px] font-bold tracking-wide text-gray-600">
                  {storeInfo?.storeName || "Store"}
                </p>
                <p className="text-[8px] text-gray-500">AUTHORIZED</p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 mt-6 pt-3 text-center">
            {storeInfo?.footer && (
              <p className="text-[9px] font-bold">{storeInfo.footer}</p>
            )}
            <p className="text-[8px] text-gray-400 mt-1.5">
              Powered By Smartsoft Innovation | 01999878862
            </p>
          </div>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 print:hidden"
          onClick={() => setShowSettings(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white">
                Challan Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <FiX className="size-4" />
              </button>
            </div>

            <div className="px-5 py-3">
              <p className="text-[10px] font-bold tracking-wide text-gray-400 uppercase mb-1">
                Page
              </p>
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-700 dark:text-gray-200">
                  Page Size
                </span>
                <div className="flex gap-1">
                  {(["A4", "A5"] as const).map((size) => (
                    <button
                      key={size}
                      onClick={() => update("pageSize", size)}
                      className={`px-3 py-1 rounded-md text-[11px] font-bold transition-colors ${
                        settings.pageSize === size
                          ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <ToggleRow
                label="Pre-printed Letterhead"
                checked={settings.letterhead}
                onChange={(v) => update("letterhead", v)}
              />

              <p className="text-[10px] font-bold tracking-wide text-gray-400 uppercase mb-1 mt-4">
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
                label="Color / Size"
                checked={settings.showColorSize}
                onChange={(v) => update("showColorSize", v)}
              />
              <ToggleRow
                label="SKU"
                checked={settings.showSerial}
                onChange={(v) => update("showSerial", v)}
              />
              <ToggleRow
                label="Remarks"
                checked={settings.showRemarks}
                onChange={(v) => update("showRemarks", v)}
              />
              <ToggleRow
                label="Received Note"
                checked={settings.showReceivedNote}
                onChange={(v) => update("showReceivedNote", v)}
              />
              <ToggleRow
                label="Signatures"
                checked={settings.showSignatures}
                onChange={(v) => update("showSignatures", v)}
              />
            </div>

            <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold transition-colors"
              >
                Done
              </button>
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
        checked ? "left-[22px]" : "left-0.5"
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
    <span className="text-[9px] text-gray-500">{label}</span>
    <span className="text-[9px] font-bold text-right">{value}</span>
  </div>
);

const StatusPill = ({ value }: { value: string }) => (
  <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[8px] font-bold uppercase tracking-wide">
    {value}
  </span>
);

export default SalesChallanPrint;
