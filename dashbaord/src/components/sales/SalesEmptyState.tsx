import { MdOutlineQrCodeScanner } from "react-icons/md";
import { FaSearch } from "react-icons/fa";
import { BsBoxSeam } from "react-icons/bs";

// Placeholder for the sales cart table before the first line is added. Kept
// deliberately short so it never pushes the table body into a scroll.
// The cart table can be wider than its scroll area, so this is pinned to the
// visible width (the table's @container) or its center would be off screen.
const SalesEmptyState = () => {
  return (
    <div className="sticky left-0 flex h-full min-h-[220px] w-[100cqw] flex-col items-center justify-center gap-3 px-4 py-10 [@media(max-height:820px)]:min-h-0 [@media(max-height:820px)]:py-3">
      {/* On a short screen the cart row is small: the words alone fit without scrolling */}
      <div className="relative [@media(max-height:820px)]:hidden">
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

      <div className="flex flex-wrap items-center justify-center gap-2 [@media(max-height:820px)]:hidden">
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
