import { forwardRef, useState } from "react";
import { FaSearchMinus, FaSearchPlus } from "react-icons/fa";
import BarcodeLabel from "./BarcodeLabel";
import type { BarcodeContentOptions, LabelSize, PrinterType, QueueItem } from "./types";

interface LivePreviewProps {
  queue: QueueItem[];
  shopName: string;
  contentOptions: BarcodeContentOptions;
  labelSize: LabelSize;
  printerType: PrinterType;
  fontSize: number;
}

const LivePreview = forwardRef<HTMLDivElement, LivePreviewProps>(
  ({ queue, shopName, contentOptions, labelSize, printerType, fontSize }, ref) => {
    const [zoom, setZoom] = useState(100);

    const totalLabels = queue.reduce((sum, item) => sum + item.quantity, 0);

    const labels = queue.flatMap((item) =>
      Array.from({ length: item.quantity }, (_, i) => ({
        ...item,
        renderKey: `${item.key}-${i}`,
      }))
    );

    return (
      <div className="rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-full flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              Preview
            </h3>
            <p className="text-xs text-gray-400">
              {labelSize.label} | {printerType === "a4" ? "A4" : "Roll"} ·{" "}
              {totalLabels} labels
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
              aria-label="Zoom out"
              className="shine size-8 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20"
            >
              <FaSearchMinus className="size-3" />
            </button>
            <span className="text-xs font-medium text-gray-500 w-10 text-center">
              {zoom}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
              aria-label="Zoom in"
              className="shine size-8 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20"
            >
              <FaSearchPlus className="size-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {labels.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-400 font-medium min-h-[300px]">
              Select items to see the barcode preview here.
            </div>
          ) : (
            <div
              ref={ref}
              className="flex flex-wrap gap-2 origin-top-left"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              {labels.map((label) => (
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
          )}
        </div>
      </div>
    );
  }
);

LivePreview.displayName = "LivePreview";

export default LivePreview;
