import { MdOutlineQrCodeScanner } from "react-icons/md";
import { FaSearch } from "react-icons/fa";
import { BsBoxSeam } from "react-icons/bs";

// Placeholder for the sales cart table before the first line is added. Kept
// deliberately short so it never pushes the table body into a scroll.
const SalesEmptyState = () => {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 px-4 py-10">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-accent-500/10 blur-md" />
        <span className="relative flex size-14 items-center justify-center rounded-full border border-dashed border-accent-300 bg-accent-50 text-accent-600 dark:border-accent-500/40 dark:bg-accent-500/15 dark:text-accent-400">
          <BsBoxSeam className="size-6" />
        </span>
      </div>

      <div className="text-center">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
          Cart is empty
        </p>
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
          Add a product to start this sale.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          <MdOutlineQrCodeScanner className="size-3.5 text-accent-600 dark:text-accent-400" />
          Scan barcode
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          <FaSearch className="size-3 text-accent-600 dark:text-accent-400" />
          Search by name or SKU
        </span>
      </div>
    </div>
  );
};

export default SalesEmptyState;
