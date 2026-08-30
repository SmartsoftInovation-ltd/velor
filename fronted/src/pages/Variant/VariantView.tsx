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
  FaEdit, FaToggleOn, FaToggleOff, FaArrowLeft,
  FaBarcode, FaTag, FaLayerGroup, FaBox,
  FaMoneyBillWave, FaInfoCircle, FaGlobe,
  FaSearch, FaRulerCombined, FaWeightHanging,
  FaBoxes, FaExternalLinkAlt, FaChevronRight,
  FaImage, FaCheckCircle, FaTimesCircle
} from "react-icons/fa";
import moment from "moment";
import { showApiError } from "../../utils/apiError";

const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top });
      setVisible(true);
    }
  };
  return (
    <div ref={ref} className="inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && createPortal(
        <div className="fixed z-[99999] pointer-events-none" style={{ left: coords.x, top: coords.y - 8, transform: "translate(-50%, -100%)" }}>
          <div className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        </div>, document.body
      )}
    </div>
  );
};

// InfoCard sub-component
const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="group bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-500/30 hover:shadow-md transition-all duration-200">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-gray-400 group-hover:text-blue-500 transition-colors">{icon}</span>
      <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{label}</p>
    </div>
    <div className="text-sm font-bold text-gray-700 dark:text-gray-200">{value}</div>
  </div>
);

// LinkCard for category/brand navigation
const LinkCard = ({ icon, label, name, to }: { icon: React.ReactNode; label: string; name: string; to: string }) => (
  <Link to={to} className="group block">
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-200 cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-gray-400 group-hover:text-blue-500 transition-colors">{icon}</span>
          <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">{label}</p>
        </div>
        <FaExternalLinkAlt className="size-2.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-sm font-bold text-gray-700 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{name}</span>
        <FaChevronRight className="size-2.5 text-gray-300 group-hover:text-blue-400 translate-x-0 group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  </Link>
);

const VariantView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const { data: variant, isLoading, isError, refetch } = useQuery({
    queryKey: ["variant-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/variant/${slug}`);
      const v = data.data.variant;
      if (v.image?.length > 0) setActiveImage(v.image[0].url);
      else if (v.thumbnail?.url) setActiveImage(v.thumbnail.url);
      return v;
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    if (!variant) return;
    const next = !variant.isActive;
    const ep = next ? `/variant/active?slug=${variant.slug}` : `/variant/deactive?slug=${variant.slug}`;
    try {
      await axiosSecure.post(ep);
      toast.success(`Variant ${next ? "activated" : "deactivated"} successfully.`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["variants"] });
    } catch (error) {
      showApiError(error, "Failed to update variant status.");
    } finally {
      setShowConfirmModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[400px] gap-4">
        <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-blue-500" />
        <p className="text-sm text-gray-400 animate-pulse">Loading variant details...</p>
      </div>
    );
  }

  if (isError || !variant) {
    return (
      <div className="text-center py-20 min-h-[400px]">
        <div className="size-24 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-400 mx-auto mb-6">
          <FaSearch className="size-10" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Variant Not Found</h2>
        <p className="text-gray-500 mb-8 text-sm">The variant you are looking for doesn't exist or has been removed.</p>
        <Button size="sm" variant="outline" onClick={() => navigate("/variant-list")}>
          <FaArrowLeft className="size-3" /> Go Back to List
        </Button>
      </div>
    );
  }

  const allImages: string[] = [];
  if (variant.thumbnail?.url) allImages.push(variant.thumbnail.url);
  if (Array.isArray(variant.image)) {
    variant.image.forEach((img: { url: string }) => {
      if (img.url && !allImages.includes(img.url)) allImages.push(img.url);
    });
  }

  const categorySlug = variant.product?.category?.slug;
  const subcategorySlug = variant.product?.subcategory?.slug;
  const brandSlug = variant.product?.brand?.slug;

  return (
    <>
      <PageMeta title={`View Variant - ${variant.variantName}`} description="Variant details view" />
      <PageBreadcrumb pageTitle="Variant Details" />

      <div className="space-y-5">
        {/* === HEADER CARD === */}
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <FaBox className="size-5 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-800 dark:text-white">Variant Details</h2>
                  <p className="text-[11px] text-gray-400">ID: <span className="font-mono">{variant._id?.slice(-8)}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip text="Go back">
                  <Button onClick={() => navigate(-1)} variant="outline" size="sm" className="flex items-center gap-2 rounded-xl px-4">
                    <FaArrowLeft className="size-3.5" /> Back
                  </Button>
                </Tooltip>
                <Tooltip text="Edit variant">
                  <Link to={`/update-variant/${variant.slug}`}>
                    <Button size="sm" className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl px-4 shadow-md shadow-blue-500/25">
                      <FaEdit className="size-3.5" /> Edit
                    </Button>
                  </Link>
                </Tooltip>
                {variant.isActive ? (
                  <Tooltip text="Deactivate">
                    <Button onClick={() => setShowConfirmModal(true)} size="sm" className="flex items-center gap-2 rounded-xl px-4 border-none bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/25">
                      <FaToggleOn className="size-4" /> Deactivate
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip text="Activate">
                    <Button onClick={() => setShowConfirmModal(true)} size="sm" className="flex items-center gap-2 rounded-xl px-4 border-none bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/25">
                      <FaToggleOff className="size-4" /> Activate
                    </Button>
                  </Tooltip>
                )}
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* === LEFT: Image Gallery === */}
            <div className="lg:col-span-5 space-y-4">
              {/* Main Image */}
              <div className="relative aspect-square rounded-3xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 border-2 border-gray-100 dark:border-gray-800 group shadow-xl">
                {allImages.length > 0 ? (
                  <img
                    src={activeImage || allImages[0]}
                    alt={variant.variantName}
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                    <FaImage className="size-16 mb-3" />
                    <p className="text-xs font-medium">No image available</p>
                  </div>
                )}
                {/* Status Badge */}
                <div className="absolute top-4 left-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider shadow-lg ${variant.isActive ? "bg-emerald-500 text-white shadow-emerald-500/30" : "bg-red-500 text-white shadow-red-500/30"}`}>
                    {variant.isActive ? <FaCheckCircle className="size-3" /> : <FaTimesCircle className="size-3" />}
                    {variant.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
              </div>

              {/* Thumbnail Strip */}
              {allImages.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-200">
                  {allImages.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(url)}
                      className={`size-[72px] flex-shrink-0 rounded-2xl overflow-hidden border-2 transition-all duration-200 ${
                        activeImage === url
                          ? "border-blue-500 shadow-lg shadow-blue-500/20 scale-95"
                          : "border-gray-100 dark:border-gray-700 opacity-60 hover:opacity-100 hover:border-gray-300"
                      }`}
                    >
                      <img src={url} alt={`img-${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Badges */}
              <div className="flex flex-wrap gap-2">
                {variant.size && (
                  <span className="px-3 py-1.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
                    Size: {variant.size}
                  </span>
                )}
                {variant.color && (
                  <span className="px-3 py-1.5 bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
                    Color: {variant.color}
                  </span>
                )}
                {variant.unit && (
                  <span className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
                    Unit: {variant.unit}
                  </span>
                )}
                {variant.groupUnit && variant.groupUnitQuantity ? (
                  <span className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-[11px] font-bold uppercase tracking-wider">
                    {variant.groupUnit}: {variant.groupUnitQuantity}
                  </span>
                ) : null}
              </div>
            </div>

            {/* === RIGHT: Details === */}
            <div className="lg:col-span-7 space-y-5">
              {/* Name Banner */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/5 dark:to-indigo-500/5 rounded-3xl p-6 border border-blue-100/60 dark:border-blue-500/10">
                <p className="text-[10px] uppercase font-black tracking-[2.5px] text-orange-500 mb-1">Parent Product</p>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">
                  {variant.product?.name || "N/A"}
                </p>
                <p className="text-[10px] uppercase font-black tracking-[2.5px] text-blue-500 mb-1">Variant Name</p>
                <h1 className="text-2xl font-black text-gray-900 dark:text-white">{variant.variantName}</h1>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard icon={<FaBarcode className="size-3.5" />} label="Barcode" value={<span className="font-mono">{variant.barCode || "N/A"}</span>} />
                <InfoCard icon={<FaTag className="size-3.5" />} label="SKU" value={<span className="font-mono">{variant.sku || "N/A"}</span>} />
                <InfoCard icon={<FaBoxes className="size-3.5" />} label="Stock Variant" value={
                  <div className="flex items-center gap-2">
                    <span>{variant.stockVariant ?? 0}</span>
                    {(variant.stockVariant ?? 0) <= (variant.alertVariantStock ?? 5) && (
                      <span className="px-1.5 py-0.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-md">LOW</span>
                    )}
                  </div>
                } />
                <InfoCard icon={<FaInfoCircle className="size-3.5" />} label="Alert Stock" value={variant.alertVariantStock ?? 0} />
              </div>

              {/* Pricing */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <FaMoneyBillWave className="text-emerald-500 size-4" />
                  <h3 className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">Pricing</h3>
                </div>
                <div className="grid grid-cols-3 divide-x divide-gray-50 dark:divide-gray-800">
                  <div className="p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Buy Rate</p>
                    <p className="text-lg font-black text-gray-800 dark:text-white">{variant.purchasePrice ?? 0}<span className="text-xs text-gray-400 ml-0.5">TK</span></p>
                  </div>
                  <div className="p-4 text-center bg-emerald-50/60 dark:bg-emerald-500/5">
                    <p className="text-[10px] uppercase font-bold text-emerald-600 mb-1">Retail</p>
                    <p className="text-xl font-black text-emerald-600">{variant.retailPrice ?? 0}<span className="text-xs ml-0.5">TK</span></p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Wholesale</p>
                    <p className="text-lg font-black text-gray-800 dark:text-white">{variant.wholesalePrice ?? 0}<span className="text-xs text-gray-400 ml-0.5">TK</span></p>
                  </div>
                </div>
              </div>

              {/* Category / Subcategory / Brand — Clickable */}
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-3 flex items-center gap-2">
                  <FaLayerGroup className="size-3" /> Organization
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <LinkCard
                    icon={<FaLayerGroup className="size-3.5" />}
                    label="Category"
                    name={variant.product?.category?.name || "N/A"}
                    to={categorySlug ? `/category-view/${categorySlug}` : "#"}
                  />
                  <LinkCard
                    icon={<FaChevronRight className="size-3.5" />}
                    label="Subcategory"
                    name={variant.product?.subcategory?.name || "N/A"}
                    to={subcategorySlug ? `/subcategory-view/${subcategorySlug}` : "#"}
                  />
                  <LinkCard
                    icon={<FaTag className="size-3.5" />}
                    label="Brand"
                    name={variant.product?.brand?.name || "N/A"}
                    to={brandSlug ? `/brand-view/${brandSlug}` : "#"}
                  />
                </div>
              </div>

              {/* Dimensions & Weight */}
              {(variant.dimensions || variant.weight !== undefined) && (
                <div className="grid grid-cols-2 gap-3">
                  {variant.dimensions && (
                    <InfoCard
                      icon={<FaRulerCombined className="size-3.5" />}
                      label="Dimensions (W×H×D cm)"
                      value={`${variant.dimensions.width ?? 0} × ${variant.dimensions.height ?? 0} × ${variant.dimensions.depth ?? 0}`}
                    />
                  )}
                  {variant.weight !== undefined && (
                    <InfoCard
                      icon={<FaWeightHanging className="size-3.5" />}
                      label="Weight"
                      value={`${variant.weight} g`}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* === BOTTOM SECTIONS === */}
          <div className="mt-10 space-y-6 border-t border-gray-50 dark:border-gray-800 pt-8">
            {/* Specifications */}
            {variant.specifications && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <FaInfoCircle className="text-blue-500 size-4" />
                  <h3 className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">Specifications</h3>
                </div>
                <div
                  className="p-6 prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400"
                  dangerouslySetInnerHTML={{ __html: variant.specifications }}
                />
              </div>
            )}

            {/* SEO */}
            {variant.seo && (
              <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                  <FaGlobe className="text-blue-500 size-4" />
                  <h3 className="text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">SEO / Meta Information</h3>
                </div>
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                  {[
                    { label: "Meta Title", value: variant.seo.metaTitle },
                    { label: "Meta Description", value: variant.seo.metaDescription },
                    { label: "Focus Keyword", value: variant.seo.focusKeyword },
                    { label: "Canonical URL", value: variant.seo.canonicalUrl },
                    { label: "Twitter Card", value: variant.seo.twitterCard },
                    { label: "Meta Keywords", value: Array.isArray(variant.seo.metaKeywords) ? variant.seo.metaKeywords.join(", ") : variant.seo.metaKeywords },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[9px] uppercase font-black tracking-widest text-gray-400 mb-1">{label}</p>
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 break-words">{value || <span className="italic text-gray-300">N/A</span>}</p>
                    </div>
                  ))}
                  <div>
                    <p className="text-[9px] uppercase font-black tracking-widest text-gray-400 mb-1">NoIndex</p>
                    <Badge color={variant.seo.noIndex ? "error" : "success"} variant="light" className="text-[10px]">{variant.seo.noIndex ? "Yes" : "No"}</Badge>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-black tracking-widest text-gray-400 mb-1">NoFollow</p>
                    <Badge color={variant.seo.noFollow ? "error" : "success"} variant="light" className="text-[10px]">{variant.seo.noFollow ? "Yes" : "No"}</Badge>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex flex-wrap justify-between items-center px-2 py-3 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 font-medium gap-3">
              <p>ID: <span className="font-mono text-gray-500">{variant._id}</span></p>
              <p>Created: <span className="text-gray-500">{moment(variant.createdAt).format("MMM DD, YYYY · HH:mm")}</span></p>
              <p>Updated: <span className="text-gray-500">{moment(variant.updatedAt).format("MMM DD, YYYY · HH:mm")}</span></p>
            </div>
          </div>
        </ComponentCard>
      </div>

      {/* === CONFIRM MODAL === */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} className="!w-full !max-w-sm">
        <div className="p-8">
          <div className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${variant.isActive ? "bg-red-50 dark:bg-red-500/10" : "bg-emerald-50 dark:bg-emerald-500/10"}`}>
            {variant.isActive ? <FaToggleOn className="size-8 text-red-500" /> : <FaToggleOff className="size-8 text-emerald-500" />}
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
            {variant.isActive ? "Deactivate Variant?" : "Activate Variant?"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-semibold ${variant.isActive ? "text-red-500" : "text-emerald-500"}`}>
              {variant.isActive ? "deactivate" : "activate"}
            </span>{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">"{variant.variantName}"</span>?
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={() => setShowConfirmModal(false)} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
            <Button
              onClick={handleToggleStatus}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none ${variant.isActive ?"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg" :"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"}`}
            >
              {variant.isActive ? "Yes, Deactivate" : "Yes, Activate"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default VariantView;
