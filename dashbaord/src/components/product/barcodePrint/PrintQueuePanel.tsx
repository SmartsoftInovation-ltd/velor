import { FaTimes } from "react-icons/fa";
import type { QueueItem } from "./types";

interface PrintQueuePanelProps {
  queue: QueueItem[];
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
}

const PrintQueuePanel: React.FC<PrintQueuePanelProps> = ({
  queue,
  onQuantityChange,
  onRemove,
}) => {
  const totalLabels = queue.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
            Print Queue
          </h3>
          {queue.length > 0 && (
            <span className="size-5 flex items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-bold">
              {queue.length}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 font-medium">
          {totalLabels} labels
        </span>
      </div>

      {queue.length === 0 ? (
        <div className="py-8 text-center text-xs text-gray-400 font-medium border border-dashed border-gray-200 dark:border-gray-700 rounded-md">
          No items selected yet. Pick products, purchase items, or variants above.
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {queue.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                  {item.name}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {item.code} · MRP.{item.price}/-
                  {item.size ? ` [${item.size}]` : ""}
                  {item.color ? ` [${item.color}]` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onQuantityChange(item.key, Math.max(1, item.quantity - 1))
                  }
                  className="size-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-sm outline-none focus:outline-none"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    onQuantityChange(
                      item.key,
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  }
                  className="w-12 text-center text-sm py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white outline-none focus:border-brand-500"
                />
                <button
                  type="button"
                  onClick={() => onQuantityChange(item.key, item.quantity + 1)}
                  className="size-7 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold text-sm outline-none focus:outline-none"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(item.key)}
                  className="size-7 flex items-center justify-center rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors ml-1 outline-none focus:outline-none"
                >
                  <FaTimes className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrintQueuePanel;
