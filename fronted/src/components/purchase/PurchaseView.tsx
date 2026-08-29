import { useParams, useNavigate, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import moment from "moment";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import { FaEdit, FaSync } from "react-icons/fa";
import Button from "../ui/button/Button";

// ---------- Types ----------
interface SupplierRef {
  _id: string;
  supplierName?: string;
  contactPersonName?: string;
  mobile?: string;
  supplierAddress?: string;
  openingDues?: number;
}

interface AccountRef {
  _id: string;
  name?: string;
}

interface VariantRef {
  _id: string;
  variantName?: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  thumbnail?: { url: string };
  image?: Array<{ url: string }>;
}

interface ProductRef {
  _id: string;
  name?: string;
  barCode?: string;
  sku?: string;
  thumbnail?: { url: string };
  image?: Array<{ url: string }>;
}

interface PurchaseItem {
  _id: string;
  product?: ProductRef | null;
  variant?: VariantRef | null;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice?: number;
  quantity: number;
  size?: string;
  color?: string;
  subTotal?: number;
}

interface Purchase {
  _id: string;
  invoiceNumber: string;
  date: string;
  supplierId?: SupplierRef | null;
  cashType?: AccountRef | null;
  allproduct: PurchaseItem[];
  subTotal: number;
  commission: number;
  shipping: number;
  payable: number;
  dueamount: number;
  paid: number;
  createdAt: string;
}

// ---------- Helper ----------
const getItemImage = (item: PurchaseItem): string => {
  const src = item.variant ?? item.product;
  if (!src) return "";
  if (src.thumbnail?.url) return src.thumbnail.url;
  if (Array.isArray((src as any).image) && (src as any).image.length > 0)
    return (src as any).image[0].url;
  return "";
};

const getItemName = (item: PurchaseItem): string => {
  if (item.variant) return item.variant.variantName || "—";
  if (item.product) return item.product.name || "—";
  return "—";
};

const getItemBarcode = (item: PurchaseItem): string => {
  return item.variant?.barCode || item.product?.barCode || "—";
};

const getItemSku = (item: PurchaseItem): string => {
  return item.variant?.sku || item.product?.sku || "—";
};

// ---------- Info Card ----------
const InfoCard = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
    <p className="text-sm font-semibold text-gray-800 dark:text-white">{value || "—"}</p>
  </div>
);

// ---------- Component ----------
const PurchaseView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: purchase,
    isLoading,
    isError,
    refetch,
  } = useQuery<Purchase>({
    queryKey: ["purchase", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/purchase/single-purchase/${id}`);
      return data.data.purchase;
    },
    enabled: !!id,
  });

  if (isLoading)
    return (
      <div className="flex justify-center min-h-100 items-center">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );

  if (isError || !purchase)
    return (
      <div className="flex flex-col items-center justify-center min-h-100 text-center">
        <p className="text-red-500 font-bold text-lg mb-4">Failed to load purchase!</p>
        <Button onClick={() => refetch()} className="px-6 py-2 bg-brand-500 text-white rounded-xl">
          Try Again
        </Button>
      </div>
    );

  const rowTotal = (item: PurchaseItem) =>
    (item.purchasePrice || 0) * (item.quantity || 1);

  return (
    <>
      <PageMeta
        title={`Purchase ${purchase.invoiceNumber} - Baig Ecommerce`}
        description="Purchase details"
      />
      <PageBreadcrumb pageTitle="Purchase Details" />

      <div className="space-y-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 px-6 py-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 px-4 h-10 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-brand-500 font-semibold text-sm transition-all active:scale-95"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Button>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 px-4 h-10 rounded-xl border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-brand-500 font-semibold text-sm transition-all active:scale-95"
            >
              <FaSync className="size-3.5" />
              Refresh
            </Button>
          </div>
          <Link to={`/update-purchase/${purchase._id}`}>
            <Button
              size="sm"
                className="flex items-center gap-2 px-5 h-10 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95"
            >
              <FaEdit className="size-3.5" />
              Edit Purchase
            </Button>
          </Link>
        </div>

        {/* Purchase Info */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <div>
              <h2 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">
                Invoice #{purchase.invoiceNumber}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Created {moment(purchase.createdAt).format("DD MMM YYYY, hh:mm A")}
              </p>
            </div>
            <div className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider ${
              purchase.dueamount > 0
                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                : "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
            }`}>
              {purchase.dueamount > 0 ? `Due ৳${purchase.dueamount.toLocaleString()}` : "Fully Paid"}
            </div>
          </div>

          {/* Info grid */}
          <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard label="Invoice Number" value={purchase.invoiceNumber} />
            <InfoCard label="Date" value={moment(purchase.date).format("DD MMM YYYY")} />
            <InfoCard
              label="Cash Type"
              value={purchase.cashType?.name}
            />
            <InfoCard
              label="Due Amount"
              value={
                <span className={purchase.dueamount > 0 ? "text-red-500" : "text-green-600"}>
                  ৳{purchase.dueamount.toLocaleString()}
                </span>
              }
            />
          </div>

          {/* Supplier section */}
          {purchase.supplierId && (
            <div className="px-6 pb-6">
              <div className="bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-xl p-4">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3">Supplier Information</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Name</p>
                    <p className="font-semibold text-gray-800 dark:text-white">{purchase.supplierId.supplierName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Contact Person</p>
                    <p className="font-semibold text-gray-800 dark:text-white">{purchase.supplierId.contactPersonName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Mobile</p>
                    <p className="font-semibold text-gray-800 dark:text-white">{purchase.supplierId.mobile || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Address</p>
                    <p className="font-semibold text-gray-800 dark:text-white">{purchase.supplierId.supplierAddress || "—"}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Products Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <h3 className="text-sm font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              Products ({purchase.allproduct?.length || 0} items)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-200">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                  {["#", "Image", "Product / Variant", "Barcode", "SKU", "Size", "Color", "Qty", "Buy Price", "Retail", "Total"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {purchase.allproduct?.map((item, idx) => {
                  const imgUrl = getItemImage(item);
                  const total = rowTotal(item);
                  return (
                    <tr
                      key={item._id}
                      className="hover:bg-gray-50/50 dark:hover:bg-white/2 transition-colors"
                    >
                      <td className="px-4 py-4 text-center text-xs font-bold text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-4 text-center">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={getItemName(item)}
                            className="size-12 rounded-xl object-cover border border-gray-100 dark:border-gray-700 mx-auto shadow-sm"
                          />
                        ) : (
                          <div className="size-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto">
                            <span className="text-[10px] text-gray-400">N/A</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-sm font-semibold text-gray-800 dark:text-white">
                          {getItemName(item)}
                        </span>
                        {item.variant && (
                          <p className="text-[10px] text-gray-400 mt-0.5">Variant</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-mono text-gray-600 dark:text-gray-400">
                        {getItemBarcode(item)}
                      </td>
                      <td className="px-4 py-4 text-center text-xs font-mono text-gray-600 dark:text-gray-400">
                        {getItemSku(item)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300">
                          {item.size || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        {item.color && item.color !== "N/A" ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className="inline-block size-4 rounded-full border border-black/10 shadow-sm shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                              {item.color}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-bold text-gray-700 dark:text-gray-300">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                        ৳{item.purchasePrice?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">
                        ৳{item.retailPrice?.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-center text-sm font-black text-gray-800 dark:text-white">
                        ৳{total.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <h3 className="text-sm font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
              Financial Summary
            </h3>
          </div>
          <div className="p-6">
            <div className="max-w-sm ml-auto space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Sub Total</span>
                <span className="font-semibold text-gray-800 dark:text-white">৳{purchase.subTotal?.toLocaleString()}</span>
              </div>
              {purchase.commission > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Commission</span>
                  <span className="font-semibold text-gray-800 dark:text-white">৳{purchase.commission?.toLocaleString()}</span>
                </div>
              )}
              {purchase.shipping > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Shipping</span>
                  <span className="font-semibold text-gray-800 dark:text-white">৳{purchase.shipping?.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-gray-100 dark:border-gray-800 pt-3">
                <span className="font-bold text-gray-700 dark:text-gray-200">Payable</span>
                <span className="font-black text-gray-900 dark:text-white text-base">৳{purchase.payable?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Paid</span>
                <span className="font-bold text-green-600 dark:text-green-400">৳{purchase.paid?.toLocaleString()}</span>
              </div>
              <div className={`flex justify-between text-sm rounded-xl px-4 py-3 ${
                purchase.dueamount > 0
                  ? "bg-red-50 dark:bg-red-500/10"
                  : "bg-green-50 dark:bg-green-500/10"
              }`}>
                <span className={`font-black text-sm ${purchase.dueamount > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  Due Amount
                </span>
                <span className={`font-black text-base ${purchase.dueamount > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                  ৳{purchase.dueamount?.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PurchaseView;
