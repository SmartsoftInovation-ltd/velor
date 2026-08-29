import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import { FaBarcode, FaPrint } from "react-icons/fa";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ProductsSourceTab from "../../components/product/barcodePrint/ProductsSourceTab";
import PurchasesSourceTab from "../../components/product/barcodePrint/PurchasesSourceTab";
import VariantsSourceTab from "../../components/product/barcodePrint/VariantsSourceTab";
import LabelPrinterSettings from "../../components/product/barcodePrint/LabelPrinterSettings";
import PrintQueuePanel from "../../components/product/barcodePrint/PrintQueuePanel";
import LivePreview from "../../components/product/barcodePrint/LivePreview";
import BarcodeLabel from "../../components/product/barcodePrint/BarcodeLabel";
import { LABEL_SIZES } from "../../components/product/barcodePrint/types";
import type {
  BarcodeContentOptions,
  LabelSize,
  PrinterType,
  QueueItem,
  SourceTab,
} from "../../components/product/barcodePrint/types";
import { FaArrowLeftLong } from "react-icons/fa6";

const SOURCE_TABS: { id: SourceTab; label: string }[] = [
  { id: "products", label: "Products" },
  { id: "purchases", label: "Purchases" },
  { id: "variants", label: "Variants" },
];

const STORAGE_KEY = "barcode-print-state";

interface PersistedState {
  activeTab: SourceTab;
  queue: QueueItem[];
  printerType: PrinterType;
  labelSize: LabelSize;
  fontSize: number;
  contentOptions: BarcodeContentOptions;
  shopName: string;
}

const loadPersistedState = (): Partial<PersistedState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const BarcodePrint = () => {
  const persisted = useMemo(loadPersistedState, []);

  const [activeTab, setActiveTab] = useState<SourceTab>(
    persisted.activeTab ?? "products",
  );
  const [queue, setQueue] = useState<QueueItem[]>(persisted.queue ?? []);
  const [printerType, setPrinterType] = useState<PrinterType>(
    persisted.printerType ?? "roll",
  );
  const [labelSize, setLabelSize] = useState<LabelSize>(
    persisted.labelSize ?? LABEL_SIZES[0],
  );
  const [fontSize, setFontSize] = useState(persisted.fontSize ?? 10);
  const [contentOptions, setContentOptions] = useState<BarcodeContentOptions>(
    persisted.contentOptions ?? {
      shopName: true,
      productName: true,
      price: true,
      size: true,
      vatIncluded: false,
      vatPlus: false,
    },
  );
  const [shopName, setShopName] = useState(persisted.shopName ?? "");
  const [scanValue, setScanValue] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const state: PersistedState = {
      activeTab,
      queue,
      printerType,
      labelSize,
      fontSize,
      contentOptions,
      shopName,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota/serialization errors
    }
  }, [activeTab, queue, printerType, labelSize, fontSize, contentOptions, shopName]);

  useQuery({
    queryKey: ["barcode-print-store-info"],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        "/storeinformation/store-information",
        { params: { page: 1, limit: 10, search: "" } },
      );
      const stores = data?.data?.stores || [];
      if (stores[0]?.storeName) setShopName(stores[0].storeName);
      return stores;
    },
    staleTime: 5 * 60 * 1000,
  });

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Barcode Labels",
  });

  const toggleItem = (item: QueueItem) => {
    setQueue((prev) => {
      const exists = prev.some((q) => q.key === item.key);
      if (exists) return prev.filter((q) => q.key !== item.key);
      return [...prev, item];
    });
  };

  const toggleMany = (items: QueueItem[], select: boolean) => {
    setQueue((prev) => {
      if (select) {
        const existingKeys = new Set(prev.map((q) => q.key));
        const toAdd = items.filter((i) => !existingKeys.has(i.key));
        return [...prev, ...toAdd];
      }
      const removeKeys = new Set(items.map((i) => i.key));
      return prev.filter((q) => !removeKeys.has(q.key));
    });
  };

  const addOrBumpQueueItem = (item: QueueItem) => {
    setQueue((prev) => {
      const existing = prev.find((q) => q.key === item.key);
      if (existing) {
        return prev.map((q) =>
          q.key === item.key ? { ...q, quantity: q.quantity + 1 } : q,
        );
      }
      return [...prev, item];
    });
  };

  const handleScanBarcode = async () => {
    const code = scanValue.trim();
    if (!code || isScanning) return;

    setIsScanning(true);
    try {
      const { data } = await axiosSecure.get("/product/search-product", {
        params: { barCode: code },
      });
      const results = data?.data?.products || [];
      const match = results.find((r: any) => r.barCode === code);

      if (!match) {
        toast.error(`No product or variant found for barcode: ${code}`);
        return;
      }

      if (match.resultType === "variant") {
        addOrBumpQueueItem({
          key: `variant:${match._id}`,
          sourceType: "variant",
          sourceId: match._id,
          name: match.variantName || match.product?.name || "Variant",
          code: match.barCode,
          sku: match.sku,
          price: match.retailPrice ?? 0,
          size: match.size,
          color: match.color,
          quantity: 1,
        });
      } else {
        addOrBumpQueueItem({
          key: `product:${match._id}`,
          sourceType: "product",
          sourceId: match._id,
          name: match.name,
          code: match.barCode,
          sku: match.sku,
          price: match.retailPrice ?? 0,
          size: match.size,
          color: match.color,
          quantity: 1,
        });
      }
      toast.success(`Added: ${match.name || match.variantName}`);
    } catch {
      toast.error("Failed to look up barcode");
    } finally {
      setScanValue("");
      setIsScanning(false);
      scanInputRef.current?.focus();
    }
  };

  const handleQuantityChange = (key: string, quantity: number) => {
    setQueue((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity } : item)),
    );
  };

  const handleRemove = (key: string) => {
    setQueue((prev) => prev.filter((item) => item.key !== key));
  };

  const handleClearAll = () => setQueue([]);

  const printLabels = useMemo(
    () =>
      queue.flatMap((item) =>
        Array.from({ length: item.quantity }, (_, i) => ({
          ...item,
          renderKey: `${item.key}-print-${i}`,
        })),
      ),
    [queue],
  );

  return (
    <>
      <PageMeta
        title="Barcode Print - Baig Ecommerce"
        description="Generate and print product barcode labels"
      />
      <PageBreadcrumb pageTitle="" />

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-white">
              Barcode Print
            </h1>
            <p className="text-xs text-gray-400">
              Generate &amp; print product barcodes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.history.back()}
            className="size-9 px-10 py-1 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors outline-none focus:outline-none"
          >
            <FaArrowLeftLong className="size-3.5" /> Back
          </button>
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={() => handlePrint()}
            disabled={queue.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FaPrint className="size-3.5" />
            Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[560px_1fr] gap-6 items-start">
        {/* Left column */}
        <div className="space-y-6">
          {/* Scan Barcode */}
          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2">
              <FaBarcode className="size-4 text-brand-500" />
              Scan Barcode
            </h3>
            <input
              ref={scanInputRef}
              type="text"
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScanBarcode();
                }
              }}
              disabled={isScanning}
              autoFocus
              placeholder="Scan a product or variant barcode..."
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition-all placeholder:text-gray-400 dark:text-white disabled:opacity-60"
            />
            <p className="text-xs text-gray-400">
              Focus this field and scan — the matching product/variant is
              added using its stored database barcode.
            </p>
          </div>

          {/* Select Source */}
          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              Select Source
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {SOURCE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 rounded-md text-sm font-medium border transition-colors ${
                    activeTab === tab.id
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                      : "border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "products" && (
              <ProductsSourceTab queue={queue} onToggle={toggleItem} />
            )}
            {activeTab === "purchases" && (
              <PurchasesSourceTab
                queue={queue}
                onToggle={toggleItem}
                onToggleMany={toggleMany}
              />
            )}
            {activeTab === "variants" && (
              <VariantsSourceTab queue={queue} onToggle={toggleItem} />
            )}
          </div>

          {/* Label & Printer Settings */}
          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white mb-4">
              Label &amp; Printer Settings
            </h3>
            <LabelPrinterSettings
              printerType={printerType}
              onPrinterTypeChange={setPrinterType}
              labelSize={labelSize}
              onLabelSizeChange={setLabelSize}
              contentOptions={contentOptions}
              onContentOptionsChange={setContentOptions}
              shopName={shopName}
              onShopNameChange={setShopName}
              fontSize={fontSize}
              onFontSizeChange={setFontSize}
            />
          </div>

          {/* Print Queue */}
          <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <PrintQueuePanel
              queue={queue}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemove}
            />
          </div>
        </div>

        {/* Right column — Live Preview */}
        <div className="lg:sticky lg:top-6">
          <LivePreview
            queue={queue}
            shopName={shopName}
            contentOptions={contentOptions}
            labelSize={labelSize}
            printerType={printerType}
            fontSize={fontSize}
          />
        </div>
      </div>

      {/* Hidden print-only layout */}
      <div className="hidden">
        <div ref={printRef} className="print-labels-root">
          <style>{`
            @media print {
              @page { size: ${printerType === "a4" ? "A4" : `${labelSize.widthMm}mm ${labelSize.heightMm}mm`}; margin: ${printerType === "a4" ? "10mm" : "0"}; }
              body { margin: 0; }
            }
            .print-labels-root { display: flex; flex-wrap: wrap; gap: 4px; }
          `}</style>
          {printLabels.map((label) => (
            <BarcodeLabel
              key={label.renderKey}
              shopName={shopName}
              productName={label.name}
              price={label.price}
              size={label.size}
              color={label.color}
              sku={label.sku}
              code={label.code}
              contentOptions={contentOptions}
              labelSize={labelSize}
              fontSize={fontSize}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default BarcodePrint;
