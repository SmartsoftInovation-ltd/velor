import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { FaArrowLeft, FaEdit, FaBoxOpen, FaTags, FaImage } from "react-icons/fa";
import { MdInventory } from "react-icons/md";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

// ---------- Types ----------

interface SubRef  { name: string }
interface ImageDoc { url?: string }
interface ProdRef {
  name?: string;
  subcategory?: SubRef; category?: SubRef; brand?: SubRef;
  thumbnail?: ImageDoc;
}

interface ProductId {
  name: string; barCode?: string; sku?: string;
  size?: string; color?: string; stock?: number;
  subcategory?: SubRef; category?: SubRef; brand?: SubRef;
  purchasePrice?: number; retailPrice?: number; wholesalePrice?: number;
  groupUnit?: string; groupUnitQuantity?: number; unit?: string;
  thumbnail?: ImageDoc;
}
interface VariantId {
  variantName: string; barCode?: string; sku?: string;
  size?: string; color?: string; stockVariant?: number;
  purchasePrice?: number; retailPrice?: number; wholesalePrice?: number;
  thumbnail?: ImageDoc;
  product?: ProdRef;
}
interface StockAdjustment {
  _id: string; date: string;
  increaseQuantity: number | null;
  decreaseQuantity: number | null;
  adjustReason: string;
  productId?: ProductId;
  variantId?: VariantId;
}

// ---------- Stat card ----------

const StatCard = ({
  label, value, sub, accent,
}: {
  label: string; value: React.ReactNode; sub?: string; accent: string;
}) => (
  <div className={`rounded-2xl border p-5 flex flex-col gap-2 ${accent}`}>
    <span className="text-xs font-semibold uppercase tracking-widest opacity-60">{label}</span>
    <div className="text-2xl font-bold">{value}</div>
    {sub && <span className="text-xs opacity-50">{sub}</span>}
  </div>
);

// ---------- Field cell ----------

const Field = ({ label, value, span = 1 }: { label: string; value: React.ReactNode; span?: number }) => (
  <div className={`flex flex-col gap-1 ${span === 2 ? "col-span-2" : ""}`}>
    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</span>
    <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{value}</div>
  </div>
);

// ---------- Section card ----------

const Card = ({
  title, icon, children,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden">
    <div className="flex items-center gap-2.5 px-6 py-4 border-b border-gray-100 dark:border-white/[0.06] bg-gray-50/70 dark:bg-white/[0.02]">
      <span className="text-brand-500">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

// ---------- Page ----------

const StockAdjustView = () => {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem]           = useState<StockAdjustment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const { data } = await axiosSecure.get(`/stock/stock-adjust/${id}`);
        setItem(data.data.stockAdjust);
      } catch {
        toast.error("Failed to load stock adjustment");
        navigate("/stock-adjustment-list");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) return null;

  const isVariant = !item.productId && !!item.variantId;

  const name    = item.productId?.name    ?? item.variantId?.product?.name    ?? "N/A";
  const varName = item.productId ? "Single Variant" : (item.variantId?.variantName ?? "N/A");
  const barcode = item.productId?.barCode ?? item.variantId?.barCode ?? item.variantId?.sku ?? "N/A";
  const sku     = item.productId?.sku     ?? item.variantId?.sku     ?? "N/A";
  const subcat  = item.productId?.subcategory?.name ?? item.variantId?.product?.subcategory?.name ?? "N/A";
  const cat     = item.productId?.category?.name    ?? item.variantId?.product?.category?.name    ?? "N/A";
  const brand   = item.productId?.brand?.name       ?? item.variantId?.product?.brand?.name       ?? "N/A";
  const size    = item.productId?.size  ?? item.variantId?.size  ?? "N/A";
  const color   = item.productId?.color ?? item.variantId?.color ?? "N/A";
  const stock   = item.productId?.stock ?? item.variantId?.stockVariant ?? 0;
  const buyRate = item.productId?.purchasePrice  ?? item.variantId?.purchasePrice  ?? null;
  const retail  = item.productId?.retailPrice    ?? item.variantId?.retailPrice    ?? null;
  const ws      = item.productId?.wholesalePrice ?? item.variantId?.wholesalePrice ?? null;
  const grpUnit = item.productId?.groupUnit ?? null;
  const grpQty  = item.productId?.groupUnitQuantity ?? null;
  const unit    = item.productId?.unit ?? "";

  // Image: prefer variant thumbnail, fall back to product thumbnail
  const thumbUrl =
    item.variantId?.thumbnail?.url ||
    item.productId?.thumbnail?.url ||
    item.variantId?.product?.thumbnail?.url ||
    null;

  const fmt     = (v: number | null) => v != null ? `৳ ${v.toLocaleString()}` : "N/A";
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <>
      <PageMeta title={`Stock Adjustment — ${name}`} description="Stock adjustment detail view" />
      <PageBreadcrumb pageTitle="Stock Adjustment Detail" />

      <div className="space-y-6 w-full">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/stock-adjustment-list")}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-500 transition-colors font-medium"
          >
            <FaArrowLeft size={12} />
            Back to List
          </button>

          <button
            onClick={() => navigate(`/stock-adjustment-edit/${id}`)}
            className="flex items-center gap-2 h-9 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <FaEdit size={12} />
            Edit Adjustment
          </button>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Date"
            value={fmtDate(item.date)}
            accent="border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] text-gray-700 dark:text-gray-300"
          />
          <StatCard
            label="Increase (+)"
            value={item.increaseQuantity != null ? `+${item.increaseQuantity}` : "—"}
            sub={item.increaseQuantity != null ? "units added to stock" : undefined}
            accent={
              item.increaseQuantity != null
                ? "border-green-100 dark:border-green-500/20 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                : "border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] text-gray-400"
            }
          />
          <StatCard
            label="Decrease (−)"
            value={item.decreaseQuantity != null ? `−${item.decreaseQuantity}` : "—"}
            sub={item.decreaseQuantity != null ? "units removed from stock" : undefined}
            accent={
              item.decreaseQuantity != null
                ? "border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
                : "border-gray-100 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] text-gray-400"
            }
          />
          <StatCard
            label="Current Stock"
            value={`${stock}${unit ? " " + unit : ""}`}
            sub={stock > 0 ? "in stock" : "out of stock"}
            accent={
              stock > 0
                ? "border-brand-100 dark:border-brand-500/20 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400"
                : "border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400"
            }
          />
        </div>

        {/* Reason banner */}
        <div className="rounded-2xl border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-6 py-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 block mb-1">Adjustment Reason</span>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">{item.adjustReason}</p>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product / Variant info */}
          <Card
            title={isVariant ? "Variant Information" : "Product Information"}
            icon={<FaBoxOpen size={14} />}
          >
            {/* Thumbnail */}
            <div className="flex items-start gap-5 mb-6">
              <div className="shrink-0 size-24 rounded-2xl border border-gray-100 dark:border-white/[0.08] overflow-hidden bg-gray-50 dark:bg-white/[0.03] flex items-center justify-center">
                {thumbUrl ? (
                  <img src={thumbUrl} alt={name} className="size-full object-cover" />
                ) : (
                  <FaImage size={28} className="text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold w-fit ${
                  isVariant
                    ? "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100 dark:border-violet-500/20"
                    : "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20"
                }`}>
                  {isVariant ? "Multiple Variant" : "Single Variant"}
                </span>
                <p className="text-base font-semibold text-gray-800 dark:text-gray-200">{name}</p>
                {isVariant && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{varName}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <Field label="Barcode" value={
                <span className="font-mono text-xs bg-gray-100 dark:bg-white/[0.06] px-2 py-1 rounded-lg">{barcode}</span>
              } />
              <Field label="SKU" value={
                <span className="font-mono text-xs bg-gray-100 dark:bg-white/[0.06] px-2 py-1 rounded-lg">{sku}</span>
              } />
              <Field label="Size" value={size !== "N/A" ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-gray-100 dark:bg-white/[0.06] text-xs font-semibold text-gray-700 dark:text-gray-300">{size}</span>
              ) : <span className="text-gray-400">N/A</span>} />
              <Field label="Color" value={color !== "N/A" ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <span className="size-3 rounded-full border border-gray-300 dark:border-white/20 inline-block" style={{ background: color.toLowerCase() }} />
                  {color}
                </span>
              ) : <span className="text-gray-400">N/A</span>} />
              {grpQty != null && grpUnit && (
                <Field label="Group Unit" value={`${grpQty} ${grpUnit} per group`} span={2} />
              )}
            </div>
          </Card>

          {/* Classification + Pricing stacked */}
          <div className="flex flex-col gap-6">
            <Card title="Classification" icon={<FaTags size={13} />}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
                <Field label="Category" value={cat !== "N/A" ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-100 dark:border-blue-500/20">{cat}</span>
                ) : <span className="text-gray-400">N/A</span>} />
                <Field label="Subcategory" value={subcat !== "N/A" ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-semibold border border-indigo-100 dark:border-indigo-500/20">{subcat}</span>
                ) : <span className="text-gray-400">N/A</span>} />
                <Field label="Brand" value={brand !== "N/A" ? (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 text-xs font-semibold border border-purple-100 dark:border-purple-500/20">{brand}</span>
                ) : <span className="text-gray-400">N/A</span>} />
              </div>
            </Card>

            <Card title="Pricing" icon={<MdInventory size={15} />}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Buy Rate",     value: fmt(buyRate), color: "bg-gray-50 dark:bg-white/[0.03]" },
                  { label: "Retail Price", value: fmt(retail),  color: "bg-green-50 dark:bg-green-500/10" },
                  { label: "Wholesale",    value: fmt(ws),      color: "bg-blue-50 dark:bg-blue-500/10" },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl p-4 ${color} border border-gray-100 dark:border-white/[0.05] flex flex-col gap-1`}>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</span>
                    <span className="text-base font-bold text-gray-800 dark:text-gray-200">{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default StockAdjustView;
