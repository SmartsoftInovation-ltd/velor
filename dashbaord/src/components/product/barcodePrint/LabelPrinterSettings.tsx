import { FaPrint } from "react-icons/fa";
import { MdOutlineViewAgenda } from "react-icons/md";
import Checkbox from "../../form/input/Checkbox";
import { LABEL_SIZES } from "./types";
import type { BarcodeContentOptions, LabelSize, PrinterType } from "./types";

interface LabelPrinterSettingsProps {
  printerType: PrinterType;
  onPrinterTypeChange: (type: PrinterType) => void;
  labelSize: LabelSize;
  onLabelSizeChange: (size: LabelSize) => void;
  contentOptions: BarcodeContentOptions;
  onContentOptionsChange: (options: BarcodeContentOptions) => void;
  shopName: string;
  onShopNameChange: (name: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}

const LabelPrinterSettings: React.FC<LabelPrinterSettingsProps> = ({
  printerType,
  onPrinterTypeChange,
  labelSize,
  onLabelSizeChange,
  contentOptions,
  onContentOptionsChange,
  shopName,
  onShopNameChange,
  fontSize,
  onFontSizeChange,
}) => {
  const toggleOption = (key: keyof BarcodeContentOptions) => {
    onContentOptionsChange({ ...contentOptions, [key]: !contentOptions[key] });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Printer Type
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onPrinterTypeChange("roll")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors outline-none focus:outline-none ${
                printerType === "roll"
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <FaPrint className="size-3.5" />
              Roll
            </button>
            <button
              type="button"
              onClick={() => onPrinterTypeChange("a4")}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-colors outline-none focus:outline-none ${
                printerType === "a4"
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <MdOutlineViewAgenda className="size-3.5" />
              A4
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Label Size
          </p>
          <select
            value={labelSize.id}
            onChange={(e) => {
              const found = LABEL_SIZES.find((s) => s.id === e.target.value);
              if (found) onLabelSizeChange(found);
            }}
            className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
          >
            {LABEL_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Barcode Content
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { key: "shopName", label: "Shop Name" },
              { key: "productName", label: "Product Name" },
              { key: "price", label: "Price" },
              { key: "size", label: "Size" },
              { key: "vatPlus", label: "VAT ++" },
              { key: "vatIncluded", label: "INCL. VAT" },
            ] as { key: keyof BarcodeContentOptions; label: string }[]
          ).map(({ key, label }) => (
            <div
              key={key}
              onClick={() => toggleOption(key)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                contentOptions[key]
                  ? "bg-brand-50 dark:bg-brand-500/10"
                  : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800/70"
              }`}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={contentOptions[key]}
                  onChange={() => toggleOption(key)}
                />
              </div>
              <span className="text-sm font-medium text-gray-800 dark:text-white">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Shop Name
          </p>
          <input
            type="text"
            value={shopName}
            onChange={(e) => onShopNameChange(e.target.value)}
            placeholder="Shop name"
            className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Font Size
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onFontSizeChange(Math.max(6, fontSize - 1))}
              className="size-9 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold outline-none focus:outline-none"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium text-gray-800 dark:text-white">
              {fontSize}
            </span>
            <button
              type="button"
              onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
              className="size-9 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold outline-none focus:outline-none"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LabelPrinterSettings;
