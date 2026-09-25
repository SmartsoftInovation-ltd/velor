import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { FaArrowLeft, FaEye, FaImage } from "react-icons/fa";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import Label from "../form/Label";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import MobileActionBar from "../common/MobileActionBar";
import { showApiError } from "../../utils/apiError";

// ---------- Types ----------

interface SubRef {
  name: string;
}
interface ImageDoc {
  url?: string;
}
interface ProdRef {
  name?: string;
  subcategory?: SubRef;
  category?: SubRef;
  brand?: SubRef;
  thumbnail?: ImageDoc;
}

interface ProductId {
  name: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  stock?: number;
  subcategory?: SubRef;
  category?: SubRef;
  brand?: SubRef;
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  groupUnit?: string;
  groupUnitQuantity?: number;
  unit?: string;
  thumbnail?: ImageDoc;
}
interface VariantId {
  variantName: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  stockVariant?: number;
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  thumbnail?: ImageDoc;
  product?: ProdRef;
}
interface StockAdjustment {
  _id: string;
  date: string;
  increaseQuantity: number | null;
  decreaseQuantity: number | null;
  adjustReason: string;
  productId?: ProductId;
  variantId?: VariantId;
}

// ---------- Info chip (read-only context) ----------

const InfoChip = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {label}
    </span>
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/[0.03] rounded-lg px-3 py-2 border border-gray-100 dark:border-white/[0.05]">
      {value}
    </span>
  </div>
);

// ---------- Page ----------

const StockAdjustEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<StockAdjustment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields
  const [increaseQty, setIncreaseQty] = useState("");
  const [decreaseQty, setDecreaseQty] = useState("");
  const [reason, setReason] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await axiosSecure.get(`/stock/stock-adjust/${id}`);
        const adj: StockAdjustment = data.data.stockAdjust;
        setItem(adj);
        setIncreaseQty(
          adj.increaseQuantity != null ? String(adj.increaseQuantity) : "",
        );
        setDecreaseQty(
          adj.decreaseQuantity != null ? String(adj.decreaseQuantity) : "",
        );
        setReason(adj.adjustReason);
        setDate(adj.date ? adj.date.slice(0, 10) : "");
      } catch (error) {
        showApiError(error, "Failed to load stock adjustment");
        navigate("/stock-adjustment-list");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  const handleSave = async () => {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setIsSaving(true);
    try {
      await axiosSecure.put(`/stock/stock-adjust/${id}`, {
        increaseQuantity: increaseQty !== "" ? Number(increaseQty) : null,
        decreaseQuantity: decreaseQty !== "" ? Number(decreaseQty) : null,
        adjustReason: reason,
        date,
      });
      toast.success("Stock adjustment updated");
      navigate(`/stock-adjustment-view/${id}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to update");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) return null;

  const isVariant = !item.productId && !!item.variantId;
  const name = item.productId?.name ?? item.variantId?.product?.name ?? "N/A";
  const varName = item.productId
    ? "Single"
    : (item.variantId?.variantName ?? "N/A");
  const barcode =
    item.productId?.barCode ??
    item.variantId?.barCode ??
    item.variantId?.sku ??
    "N/A";
  const sku = item.productId?.sku ?? item.variantId?.sku ?? "N/A";
  const subcat =
    item.productId?.subcategory?.name ??
    item.variantId?.product?.subcategory?.name ??
    "N/A";
  const cat =
    item.productId?.category?.name ??
    item.variantId?.product?.category?.name ??
    "N/A";
  const brand =
    item.productId?.brand?.name ??
    item.variantId?.product?.brand?.name ??
    "N/A";
  const size = item.productId?.size ?? item.variantId?.size ?? "N/A";
  const color = item.productId?.color ?? item.variantId?.color ?? "N/A";
  const stock = item.productId?.stock ?? item.variantId?.stockVariant ?? 0;
  const unit = item.productId?.unit ?? "";
  const thumbUrl =
    item.variantId?.thumbnail?.url ||
    item.productId?.thumbnail?.url ||
    item.variantId?.product?.thumbnail?.url ||
    null;

  const inp =
    "h-10 w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 text-sm text-gray-700 dark:text-gray-300 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <>
      <PageMeta
        title={`Edit Stock Adjustment — ${name}`}
        description="Edit stock adjustment"
      />
      <PageBreadcrumb pageTitle="Edit Stock Adjustment" />

      <div className="space-y-5 w-full">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/stock-adjustment-list")}
            className="shine flex items-center gap-2 h-10 px-4 rounded-xl border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 text-sm font-semibold transition-all active:scale-95"
          >
            <FaArrowLeft size={12} />
            Back to List
          </button>

          <button
            onClick={() => navigate(`/stock-adjustment-view/${id}`)}
            className="shine flex items-center gap-2 h-10 px-4 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:bg-white/5 dark:text-gray-400 dark:hover:bg-white/10 text-sm font-semibold transition-colors"
          >
            <FaEye size={12} />
            View Detail
          </button>
        </div>

        {/* Product context — read only */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.05] bg-gray-50/60 dark:bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Thumbnail */}
              <div className="size-10 rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center shrink-0">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={name}
                    className="size-full object-cover"
                  />
                ) : (
                  <FaImage
                    size={14}
                    className="text-gray-300 dark:text-gray-600"
                  />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {isVariant ? "Variant" : "Product"} Context
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {name}
                  {isVariant ? ` — ${varName}` : ""}
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                isVariant
                  ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400"
                  : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
              }`}
            >
              {isVariant ? "Multiple Variant" : "Single Variant"}
            </span>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <InfoChip label="Product" value={name} />
            {isVariant && <InfoChip label="Variant" value={varName} />}
            <InfoChip label="Barcode" value={barcode} />
            <InfoChip label="SKU" value={sku} />
            <InfoChip label="Category" value={cat} />
            <InfoChip label="Subcategory" value={subcat} />
            <InfoChip label="Brand" value={brand} />
            <InfoChip label="Size" value={size} />
            <InfoChip label="Color" value={color} />
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Current Stock
              </span>
              <div className="flex items-center h-10">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-bold ${
                    stock > 0
                      ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                      : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  }`}
                >
                  {stock} {unit}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="rounded-2xl border border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-white/[0.05] bg-gray-50/60 dark:bg-white/[0.02]">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Edit Adjustment
            </h3>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Increase Qty */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="increaseQty">Increase Quantity</Label>
                <input
                  id="increaseQty"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={increaseQty}
                  onChange={(e) => {
                    setIncreaseQty(e.target.value);
                    if (e.target.value) setDecreaseQty("");
                  }}
                  disabled={!!decreaseQty}
                  className={inp}
                />
                {!!decreaseQty && (
                  <p className="text-[11px] text-gray-400">
                    Disabled — decrease is set
                  </p>
                )}
              </div>

              {/* Decrease Qty */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="decreaseQty">Decrease Quantity</Label>
                <input
                  id="decreaseQty"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={decreaseQty}
                  onChange={(e) => {
                    setDecreaseQty(e.target.value);
                    if (e.target.value) setIncreaseQty("");
                  }}
                  disabled={!!increaseQty}
                  className={inp}
                />
                {!!increaseQty && (
                  <p className="text-[11px] text-gray-400">
                    Disabled — increase is set
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="adjDate">Adjustment Date</Label>
                <input
                  id="adjDate"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inp}
                />
              </div>
            </div>

            {/* Reason */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="reason">Reason</Label>
              <textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter adjustment reason…"
                className="w-full rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 placeholder:text-gray-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 resize-none"
              />
            </div>

            {/* Actions */}
            <MobileActionBar>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate("/stock-adjustment-list")}
                  className="shine h-10 px-5 rounded-xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="shine h-10 px-6 rounded-xl bg-accent-500 hover:bg-accent-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 min-w-36"
                >
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Saving…
                    </span>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </MobileActionBar>
          </div>
        </div>
      </div>
    </>
  );
};

export default StockAdjustEdit;
