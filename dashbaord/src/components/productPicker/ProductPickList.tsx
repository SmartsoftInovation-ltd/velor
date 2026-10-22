import { FaCheck, FaImage } from "react-icons/fa";
import { type LookupProduct, pickKey, variantLabel } from "./types";

const Box = ({ checked }: { checked: boolean }) => (
  <span
    aria-hidden="true"
    className={`flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
      checked ? "border-accent-500 bg-accent-500 text-white" : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
    }`}
  >
    {checked && <FaCheck className="size-2.5" />}
  </span>
);

const rowClass = (checked: boolean) =>
  `flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
    checked ? "bg-accent-50 dark:bg-accent-500/10" : "hover:bg-gray-50 dark:hover:bg-white/5"
  }`;

/**
 * Search results as a checklist: tick a product for the whole product, or
 * tick any of its variants underneath. Everything ticked is added together.
 */
const ProductPickList = ({
  products,
  isSelected,
  onToggle,
  variantsOnly = false,
}: {
  products: LookupProduct[];
  isSelected: (key: string) => boolean;
  onToggle: (product: LookupProduct, variantId: string | null) => void;
  /** A product with variants can only be picked by variant (a flash sale prices each one) */
  variantsOnly?: boolean;
}) => (
  <ul className="no-scrollbar max-h-80 space-y-1 overflow-y-auto overscroll-contain">
    {products.map((product) => {
      const variants = (product.variant ?? []).filter((v) => v && v.isActive !== false);
      const whole = isSelected(pickKey(product._id));
      const wholePickable = !(variantsOnly && variants.length);
      return (
        <li key={product._id}>
          <button
            type="button"
            role={wholePickable ? "checkbox" : undefined}
            aria-checked={wholePickable ? whole : undefined}
            disabled={!wholePickable}
            onClick={() => onToggle(product, null)}
            className={`${rowClass(whole)} disabled:cursor-default disabled:hover:bg-transparent`}
          >
            {wholePickable ? <Box checked={whole} /> : <span className="size-[18px] shrink-0" />}
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 dark:bg-white/5">
              {product.thumbnail?.url ? (
                <img src={product.thumbnail.url} alt="" className="size-full object-cover" />
              ) : (
                <FaImage className="size-3.5 text-gray-300 dark:text-gray-600" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-200">{product.name}</span>
            <span className="shrink-0 text-xs text-gray-400">{variants.length ? `${variants.length} variants` : "Whole product"}</span>
          </button>

          {variants.length > 0 && (
            <ul className="ml-[2.1rem] mt-0.5 space-y-0.5 border-l border-gray-100 pl-2 dark:border-gray-800">
              {variants.map((v) => {
                const checked = isSelected(pickKey(product._id, v._id));
                return (
                  <li key={v._id}>
                    <button type="button" role="checkbox" aria-checked={checked} onClick={() => onToggle(product, v._id)} className={rowClass(checked)}>
                      <Box checked={checked} />
                      <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{variantLabel(v)}</span>
                      <span className="shrink-0 text-xs tabular-nums text-gray-400">
                        ৳{(v.retailPrice ?? 0).toLocaleString()} · {v.stockVariant ?? 0} in stock
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      );
    })}
  </ul>
);

export default ProductPickList;
