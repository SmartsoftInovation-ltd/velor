import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import toast from "react-hot-toast";
import {
  FaEdit,
  FaToggleOn,
  FaToggleOff,
  FaArrowLeft,
  FaBarcode,
  FaTag,
  FaLayerGroup,
  FaBox,
  FaMoneyBillWave,
  FaInfoCircle,
  FaGlobe,
  FaSearch,
  FaBoxes
} from "react-icons/fa";
import moment from "moment";
import { showApiError } from "../../utils/apiError";

// Portal-based Tooltip
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top });
      setVisible(true);
    }
  };

  return (
    <div ref={tooltipRef} className="inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && createPortal(
        <div
          className="fixed z-[99999] pointer-events-none"
          style={{ left: coords.x, top: coords.y - 8, transform: "translate(-50%, -100%)" }}
        >
          <div className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const ProductView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const {
    data: product,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["product-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/product/getproduct/${slug}`);
      const productData = data.data.product;
      if (productData.image?.length > 0 && !activeImage) {
        setActiveImage(productData.image[0].url);
      } else if (productData.thumbnail?.url && !activeImage) {
        setActiveImage(productData.thumbnail.url);
      } else if (productData.category?.image?.url && !activeImage) {
        setActiveImage(productData.category.image.url);
      }
      return productData;
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!product) return;
    setIsToggling(true);
    try {
      await axiosSecure.put(`/product/product-status/${product.slug}`, {
        isActive: !product.isActive,
      });
      toast.success(
        `Product ${product.isActive ? "deactivated" : "activated"} successfully.`
      );
      refetch();
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (error) {
      showApiError(error, "Failed to update status.");
    } finally {
      setIsToggling(false);
      setShowConfirmModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="text-center py-20 min-h-[400px]">
        <div className="mb-6 flex justify-center">
          <div className="size-20 rounded-full bg-red-50 flex items-center justify-center text-red-500">
            <FaSearch className="size-10" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Product Not Found</h2>
        <p className="text-gray-500 mb-8">The product you are looking for doesn't exist or has been removed.</p>
        <Button size="sm" variant="outline" onClick={() => navigate("/product-list")}>
          Go Back to List
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`View Product - ${product.name}`}
        description="Product details view"
      />
      <PageBreadcrumb pageTitle="Product Details" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <FaBox className="size-5" />
                </div>
                <h2 className="text-md font-medium text-gray-800 dark:text-white/90">
                  Product Details
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip text="Go back">
                  <Button
                    onClick={() => navigate(-1)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 rounded-lg px-4 border-gray-200 dark:border-gray-700"
                  >
                    <FaArrowLeft className="size-3.5" />
                    Back
                  </Button>
                </Tooltip>

                <Tooltip text="Edit product">
                  <Link to={`/update-product/${product.slug}`}>
                    <Button
                      size="sm"
                        className="flex items-center gap-2 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] rounded-lg px-4 shadow-md"
                    >
                      <FaEdit className="size-3.5" />
                      Edit
                    </Button>
                  </Link>
                </Tooltip>

                {product.isActive ? (
                  <Tooltip text="Deactivate this product">
                    <Button
                      onClick={() => setShowConfirmModal(true)}
                      size="sm"
                      className="flex items-center gap-2 rounded-lg px-4 shadow-md border-none bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                    >
                      <FaToggleOn className="size-4" />
                      Deactivate
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip text="Activate this product">
                    <Button
                      onClick={() => setShowConfirmModal(true)}
                      size="sm"
                      className="flex items-center gap-2 rounded-lg px-4 shadow-md border-none bg-green-500 hover:bg-green-600 text-white shadow-green-500/20"
                    >
                      <FaToggleOff className="size-4" />
                      Activate
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            {/* Left Column: Images */}
            <div className="lg:col-span-5 space-y-4">
              {product.variantType !== "multipleVariant" ? (
                <>
                  <div className="aspect-square rounded-3xl overflow-hidden border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 group relative shadow-inner">
                    <img
                      src={activeImage || product.thumbnail?.url || "https://via.placeholder.com/600"}
                      alt={product.name}
                      className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-4 right-4">
                      <Badge
                        variant="solid"
                        size="sm"
                        color={product.isActive ? "success" : "error"}
                        className="uppercase font-bold tracking-widest text-[9px] px-3 py-1 shadow-lg"
                      >
                        {product.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>

                  {/* Thumbnail Gallery */}
                  {product.image?.length > 0 && (
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-200">
                      {product.image.map((img: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setActiveImage(img.url)}
                          className={`size-20 flex-shrink-0 rounded-2xl overflow-hidden border-2 transition-all ${
                            activeImage === img.url
                              ? "border-blue-500 scale-95 shadow-lg"
                              : "border-transparent opacity-70 hover:opacity-100 hover:border-gray-200"
                          }`}
                        >
                          <img src={img.url} className="w-full h-full object-cover" alt={`Thumb ${idx}`} />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-square rounded-3xl overflow-hidden border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center justify-center shadow-inner relative">
                  <div className="absolute top-4 right-4">
                    <Badge
                      variant="solid"
                      size="sm"
                      color={product.isActive ? "success" : "error"}
                      className="uppercase font-bold tracking-widest text-[9px] px-3 py-1 shadow-lg"
                    >
                      {product.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="text-center text-gray-400">
                    <FaBoxes className="size-16 mx-auto mb-4 opacity-30" />
                    <p className="font-bold uppercase tracking-widest text-xs">Multiple Variant Product</p>
                    <p className="text-[10px] mt-2">Images are managed at the variant level</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Information */}
            <div className="lg:col-span-7 space-y-6">
              {/* Product Info Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-1 md:col-span-2 bg-blue-50/30 dark:bg-blue-500/5 rounded-2xl p-6 border border-blue-100/50 dark:border-blue-500/10">
                  <p className="text-[10px] uppercase font-black tracking-[2px] text-blue-500 mb-2">Product Name</p>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{product.name}</h1>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge color="primary" variant="light" className="font-bold text-[10px] uppercase">{product.variantType}</Badge>
                    {product.unit && <Badge color="info" variant="light" className="font-bold text-[10px] uppercase">Unit: {product.unit}</Badge>}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <FaBarcode className="text-gray-400 size-3.5" />
                    <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Barcode</p>
                  </div>
                  <p className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">{product.variantType === "multipleVariant" ? "N/A" : (product.barCode || "N/A")}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 mb-2">
                    <FaTag className="text-gray-400 size-3.5" />
                    <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">SKU</p>
                  </div>
                  <p className="text-sm font-mono font-bold text-gray-700 dark:text-gray-300">{product.variantType === "multipleVariant" ? "N/A" : (product.sku || "N/A")}</p>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-theme-sm">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-50 dark:border-gray-800">
                  <FaMoneyBillWave className="text-green-500 size-4" />
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Pricing Overview</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Buy Rate</p>
                    <p className="text-xl font-black text-gray-800 dark:text-white">
                      {product.purchasePrice ? `${product.purchasePrice} TK` : "N/A"}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-500/5 rounded-2xl border border-green-100 dark:border-green-500/10">
                    <p className="text-[10px] uppercase font-bold text-green-600 mb-1">Retail Price</p>
                    <p className="text-2xl font-black text-green-600">
                      {product.retailPrice ? `${product.retailPrice} TK` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Wholesale</p>
                    <p className="text-xl font-black text-gray-800 dark:text-white">
                      {product.wholesalePrice ? `${product.wholesalePrice} TK` : "N/A"}
                    </p>
                  </div>
                </div>
                {product.retailProfitMarginByPercentage > 0 && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-500/10 rounded-full border border-blue-100 dark:border-blue-500/20">
                    <span className="text-[10px] font-bold text-blue-600 uppercase">Profit Margin:</span>
                    <span className="text-sm font-black text-blue-600">{product.retailProfitMarginByPercentage}%</span>
                  </div>
                )}
              </div>

              {/* Organization Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Category</p>
                  <div className="flex items-center gap-2">
                    <FaLayerGroup className="text-brand-500 size-3" />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{product.category?.name || "N/A"}</span>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">SubCategory</p>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{product.subcategory?.name || "N/A"}</span>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-700">
                  <p className="text-[10px] uppercase font-bold text-gray-400 mb-2">Brand</p>
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{product.brand?.name || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Info Tabs/Sections */}
          <div className="mt-12 space-y-8 animate-in slide-in-from-bottom-4 duration-700 delay-150">
            {/* Description */}
            {product.description && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-6">
                  <FaInfoCircle className="text-blue-500 size-4" />
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Product Description</h3>
                </div>
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              </div>
            )}

            {/* Variants Table */}
            {product.variantType === "multipleVariant" && product.variant?.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-2">
                    <FaBoxes className="text-orange-500 size-5" />
                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-widest">Product Variants</h3>
                  </div>
                  <Badge color="warning" variant="light" className="font-bold">{product.variant.length} Variants</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="pb-4 text-[11px] uppercase font-black text-gray-400 tracking-wider">Image</th>
                        <th className="pb-4 text-[11px] uppercase font-black text-gray-400 tracking-wider">Variant Name</th>
                        <th className="pb-4 text-[11px] uppercase font-black text-gray-400 tracking-wider">SKU/Barcode</th>
                        <th className="pb-4 text-[11px] uppercase font-black text-gray-400 tracking-wider">Price (Retail)</th>
                        <th className="pb-4 text-[11px] uppercase font-black text-gray-400 tracking-wider text-center">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {product.variant.map((v: any) => (
                        <tr key={v._id} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                          <td className="py-4">
                            <div className="size-12 rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm bg-white dark:bg-gray-800">
                              <img src={v.image?.url || "https://via.placeholder.com/100"} className="size-full object-cover" alt={v.name} />
                            </div>
                          </td>
                          <td className="py-4">
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{v.name}</p>
                          </td>
                          <td className="py-4">
                            <div className="space-y-1">
                              <p className="text-[10px] text-gray-400 font-mono">SKU: {v.sku}</p>
                              <p className="text-[10px] text-gray-400 font-mono">BC: {v.barCode}</p>
                            </div>
                          </td>
                          <td className="py-4">
                            <p className="text-sm font-black text-green-600">{v.retailPrice} TK</p>
                          </td>
                          <td className="py-4 text-center">
                            <Badge color={v.stock > 10 ? "success" : v.stock > 0 ? "warning" : "error"} variant="solid" className="font-black">
                              {v.stock}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tags and Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-gray-50 dark:bg-gray-800/30 rounded-3xl p-6 border border-gray-100 dark:border-gray-700">
                <h4 className="text-[11px] uppercase font-black text-gray-400 tracking-widest mb-4">Product Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {product.tag ? (
                    Array.isArray(product.tag) ? (
                      product.tag.map((tag: string, i: number) => (
                        <span key={i} className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400">
                          #{tag}
                        </span>
                      ))
                    ) : (
                      <span className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-600 dark:text-gray-400">
                        #{product.tag}
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-gray-400 italic">No tags defined</span>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/30 rounded-3xl p-6 border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <FaGlobe className="text-blue-500 size-3" />
                  <h4 className="text-[11px] uppercase font-black text-gray-400 tracking-widest">Meta Info (SEO)</h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Meta Title</p>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{product.seo?.metaTitle || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-gray-400 mb-0.5">Meta Keywords</p>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {Array.isArray(product.seo?.metaKeywords) 
                        ? product.seo.metaKeywords.join(", ") 
                        : product.seo?.metaKeywords || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Timestamps */}
            <div className="flex justify-between items-center px-4 py-2 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 font-medium">
              <p>Product ID: <span className="font-mono">{product._id}</span></p>
              <p>Created: {moment(product.createdAt).format("MMM DD, YYYY HH:mm")}</p>
            </div>
          </div>
        </ComponentCard>
      </div>

      <Modal 
        isOpen={showConfirmModal} 
        onClose={() => setShowConfirmModal(false)}
        className="!w-full !max-w-sm"
      >
        <div className="p-8">
          <div className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
            product.isActive ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"
          }`}>
            {product.isActive ? <FaToggleOn className="size-8 text-red-500" /> : <FaToggleOff className="size-8 text-green-500" />}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {product.isActive ? "Deactivate Product?" : "Activate Product?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to <span className={`font-semibold ${product.isActive ? "text-red-500" : "text-green-500"}`}>
              {product.isActive ? "deactivate" : "activate"}
            </span> <span className="font-semibold text-gray-700 dark:text-gray-200">"{product.name}"</span>?
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={() => setShowConfirmModal(false)} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
            <Button
              onClick={handleToggleStatus}
              disabled={isToggling}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none transition-all ${
                product.isActive
 ?"bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] shadow-lg"
 :"bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] shadow-lg"
              }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Updating...
                </span>
              ) : (
                product.isActive ? "Yes, Deactivate" : "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default ProductView;
