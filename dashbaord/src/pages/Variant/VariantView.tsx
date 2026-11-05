import { useState, type ReactNode } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft, FaChevronDown, FaEdit, FaImage, FaSearch, FaToggleOff, FaToggleOn } from "react-icons/fa";
import moment from "moment";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Loader from "../../components/common/Loader";
import Button from "../../components/ui/button/Button";
import { Modal } from "../../components/ui/modal";
import { showApiError } from "../../utils/apiError";

const CARD = "rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";
const SECONDARY_BUTTON =
  "!border-accent-100 !bg-accent-50 hover:!bg-accent-100 !text-accent-600 dark:!border-accent-500/20 dark:!bg-accent-500/15 dark:!text-accent-400";

const money = (value?: number) => `৳${(value ?? 0).toLocaleString("en-BD")}`;

const Empty = () => <span className="text-gray-400 dark:text-gray-500">N/A</span>;

const StatusPill = ({ isActive }: { isActive: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
      isActive
        ? "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
        : "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400"
    }`}
  >
    <span className={`size-1.5 rounded-full ${isActive ? "bg-accent-500 animate-pulse" : "bg-error-500"}`} />
    {isActive ? "Active" : "Inactive"}
  </span>
);

const Stat = ({ label, value, emphasis, note }: { label: string; value: ReactNode; emphasis?: boolean; note?: ReactNode }) => (
  <div className="min-w-0 bg-white px-4 py-3.5 dark:bg-gray-900">
    <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
    <dd
      className={`mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold tabular-nums ${
        emphasis ? "text-accent-600 dark:text-accent-400" : "text-gray-900 dark:text-white"
      }`}
    >
      {value}
      {note}
    </dd>
  </div>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={CARD}>
    <h2 className="border-b border-gray-100 px-5 py-3.5 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
      {title}
    </h2>
    <dl className="divide-y divide-gray-100 px-5 dark:divide-gray-800">{children}</dl>
  </section>
);

const Row = ({ label, children, mono }: { label: string; children?: ReactNode; mono?: boolean }) => (
  <div className="flex items-baseline justify-between gap-6 py-3 text-sm">
    <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className={`min-w-0 break-words text-right font-medium text-gray-800 dark:text-gray-200 ${mono ? "font-mono text-[13px]" : ""}`}>
      {children === undefined || children === null || children === "" ? <Empty /> : children}
    </dd>
  </div>
);

// Plain text when there is nowhere to go, rather than a link to nothing
const RecordLink = ({ name, to }: { name?: string; to: string; }) => {
  if (!name) return <Empty />;
  if (to.endsWith("/undefined")) return <>{name}</>;
  return (
    <Link to={to} className="text-accent-600 hover:underline dark:text-accent-400">
      {name}
    </Link>
  );
};

const VariantView = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const { data: variant, isLoading, isError, refetch } = useQuery({
    queryKey: ["variant-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/variant/${slug}`);
      return data.data.variant;
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!variant) return;
    const next = !variant.isActive;
    const ep = next ? `/variant/active?slug=${variant.slug}` : `/variant/deactive?slug=${variant.slug}`;
    setIsToggling(true);
    try {
      await axiosSecure.post(ep);
      toast.success(`Variant ${next ? "activated" : "deactivated"} successfully.`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["variants"] });
    } catch (error) {
      showApiError(error, "Failed to update variant status.");
    } finally {
      setIsToggling(false);
      setShowConfirmModal(false);
    }
  };

  if (isLoading) return <Loader />;

  if (isError || !variant) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center">
        <FaSearch className="mb-4 size-8 text-gray-300 dark:text-gray-600" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">Variant not found</h2>
        <p className="mb-6 mt-1 text-sm text-gray-500">It may have been removed, or the link is wrong.</p>
        <Button size="sm" className={`rounded-md px-4 ${SECONDARY_BUTTON}`} onClick={() => navigate("/variant-list")}>
          Back to variant list
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
  const shownImage = activeImage && allImages.includes(activeImage) ? activeImage : allImages[0];

  const product = variant.product;
  const stock = variant.stockVariant ?? 0;
  // The same order the Low Stock list reads them in
  const alertAt = variant.alertQuantity ?? variant.alertVariantStock ?? 0;
  const { width, height, depth } = variant.dimensions ?? {};
  const seo = variant.seo;

  return (
    <>
      <PageMeta title={`View Variant - ${variant.variantName}`} description="Variant details view" />
      <PageBreadcrumb
        pageTitle="Variant Details"
        className="mb-3"
        hideTitle
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(-1)}
              size="sm"
              variant="outline"
              className={`size-9 p-0 !rounded-md ${SECONDARY_BUTTON}`}
              title="Go back"
              aria-label="Go back"
            >
              <FaArrowLeft className="size-3.5" />
            </Button>
            <Button
              onClick={() => setShowConfirmModal(true)}
              size="sm"
              className={`h-9 !rounded-md px-3.5 text-sm font-semibold ${SECONDARY_BUTTON}`}
            >
              {variant.isActive ? <FaToggleOn className="size-4" /> : <FaToggleOff className="size-4" />}
              {variant.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Link to={`/update-variant/${variant.slug}`}>
              <Button size="sm" className="h-9 !rounded-md !bg-accent-500 px-3.5 text-sm font-semibold !text-white hover:!bg-accent-600">
                <FaEdit className="size-3.5" /> Edit
              </Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-4">
        {/* Who it is and what it is worth, at a glance */}
        <section className={`${CARD} grid gap-6 p-5 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]`}>
          <div className="space-y-2.5">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40">
              {shownImage ? (
                <img src={shownImage} alt={variant.variantName} className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500">
                  <FaImage className="size-8" />
                  <p className="text-xs">No image</p>
                </div>
              )}
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {allImages.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setActiveImage(url)}
                    aria-label={`Show image ${i + 1}`}
                    aria-current={shownImage === url}
                    className={`size-14 shrink-0 overflow-hidden rounded-md border-2 bg-gray-50 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-500/20 dark:bg-gray-800 ${
                      shownImage === url ? "border-accent-500" : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  <RecordLink name={product?.name} to={`/product-view/${product?.slug}`} />
                </p>
                <h1 className="mt-0.5 break-words text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl">
                  {variant.variantName}
                </h1>
              </div>
              <StatusPill isActive={!!variant.isActive} />
            </div>

            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span>Size <b className="font-medium text-gray-800 dark:text-gray-200">{variant.size || "N/A"}</b></span>
              <span>Color <b className="font-medium text-gray-800 dark:text-gray-200">{variant.color || "N/A"}</b></span>
              <span>Unit <b className="font-medium text-gray-800 dark:text-gray-200">{variant.unit || "N/A"}</b></span>
            </p>

            {/* The gap on a tinted grid draws the hairlines at every column count */}
            <dl className="mt-5 grid grid-cols-2 md:mt-auto gap-px overflow-hidden rounded-lg border border-gray-100 bg-gray-100 sm:grid-cols-3 xl:grid-cols-5 dark:border-gray-800 dark:bg-gray-800">
              <Stat
                label="In stock"
                value={stock}
                note={
                  stock <= alertAt && (
                    <span className="rounded-full bg-error-50 px-2 py-0.5 text-xs font-semibold text-error-700 dark:bg-error-500/15 dark:text-error-400">
                      Low
                    </span>
                  )
                }
              />
              <Stat label="Alert at" value={alertAt} />
              <Stat label="Buy price" value={money(variant.purchasePrice)} />
              <Stat label="Retail price" value={money(variant.retailPrice)} emphasis />
              <Stat label="Wholesale price" value={money(variant.wholesalePrice)} />
            </dl>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Identification">
            <Row label="Barcode" mono>{variant.barCode}</Row>
            <Row label="SKU" mono>{variant.sku}</Row>
            <Row label="Group unit">
              {variant.groupUnit && variant.groupUnitQuantity ? `${variant.groupUnit} of ${variant.groupUnitQuantity}` : undefined}
            </Row>
            <Row label="Dimensions (W × H × D)">{width || height || depth ? `${width ?? 0} × ${height ?? 0} × ${depth ?? 0} cm` : undefined}</Row>
            <Row label="Weight">{variant.weight ? `${variant.weight} g` : undefined}</Row>
          </Section>

          <Section title="Organization">
            <Row label="Category">
              <RecordLink name={product?.category?.name} to={`/category-view/${product?.category?.slug}`} />
            </Row>
            <Row label="Subcategory">
              <RecordLink name={product?.subcategory?.name} to={`/subcategory-view/${product?.subcategory?.slug}`} />
            </Row>
            <Row label="Brand">
              <RecordLink name={product?.brand?.name} to={`/brand-view/${product?.brand?.slug}`} />
            </Row>
            <Row label="Created">{moment(variant.createdAt).format("MMM DD, YYYY · HH:mm")}</Row>
            <Row label="Last updated">{moment(variant.updatedAt).format("MMM DD, YYYY · HH:mm")}</Row>
          </Section>
        </div>

        {variant.specifications && (
          <section className={CARD}>
            <h2 className="border-b border-gray-100 px-5 py-3.5 text-sm font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
              Specifications
            </h2>
            <div
              className="prose prose-sm max-w-none px-5 py-4 text-gray-600 dark:prose-invert dark:text-gray-400"
              dangerouslySetInnerHTML={{ __html: variant.specifications }}
            />
          </section>
        )}

        {/* Rarely read while managing stock, so it stays folded */}
        {seo && (
          <details className={`${CARD} group`}>
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-5 py-3.5 text-sm font-semibold text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-accent-500/20 dark:text-white [&::-webkit-details-marker]:hidden">
              SEO information
              <FaChevronDown className="size-3 text-gray-400 transition-transform group-open:rotate-180" />
            </summary>
            <dl className="divide-y divide-gray-100 border-t border-gray-100 px-5 dark:divide-gray-800 dark:border-gray-800">
              <Row label="Meta title">{seo.metaTitle}</Row>
              <Row label="Meta description">{seo.metaDescription}</Row>
              <Row label="Focus keyword">{seo.focusKeyword}</Row>
              <Row label="Meta keywords">{Array.isArray(seo.metaKeywords) ? seo.metaKeywords.join(", ") : seo.metaKeywords}</Row>
              <Row label="Canonical URL">{seo.canonicalUrl}</Row>
              <Row label="Twitter card">{seo.twitterCard}</Row>
              <Row label="Hidden from search (noindex)">{seo.noIndex ? "Yes" : "No"}</Row>
              <Row label="Links not followed (nofollow)">{seo.noFollow ? "Yes" : "No"}</Row>
            </dl>
          </details>
        )}

        <p className="px-1 font-mono text-xs text-gray-400 dark:text-gray-500">ID {variant._id}</p>
      </div>

      {/* === CONFIRM MODAL === */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)} className="!w-full !max-w-sm">
        <div className="p-8">
          <div className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${variant.isActive ? "bg-gray-100 dark:bg-white/5" : "bg-accent-50 dark:bg-accent-500/15"}`}>
            {variant.isActive ? <FaToggleOn className="size-8 text-gray-500" /> : <FaToggleOff className="size-8 text-accent-500" />}
          </div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
            {variant.isActive ? "Deactivate Variant?" : "Activate Variant?"}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className={`font-semibold ${variant.isActive ? "text-gray-800 dark:text-gray-100" : "text-accent-600"}`}>
              {variant.isActive ? "deactivate" : "activate"}
            </span>{" "}
            <span className="font-semibold text-gray-700 dark:text-gray-200">"{variant.variantName}"</span>?
          </p>
          <div className="flex gap-3 mt-7">
            <Button onClick={() => setShowConfirmModal(false)} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
            <Button
              onClick={handleToggleStatus}
              disabled={isToggling}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold border-none !bg-accent-500 hover:!bg-accent-600 !text-white shadow-lg"
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating...
                </span>
              ) : (
                variant.isActive ? "Yes, Deactivate" : "Yes, Activate"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default VariantView;
