import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";

import { FaEdit, FaArrowLeft, FaExternalLinkAlt } from "react-icons/fa";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import axiosSecure from "../../../hooks/useAxiosSecure";
import Button from "../../../components/ui/button/Button";

interface DiscountBanner {
  _id: string;
  slug: string;
  title: string;
  headLine: string;
  description: string;
  link: string;
  priority: number;
  image: { url: string; status: string } | string;
  createdAt: string;
  updatedAt: string;
}

const getImageUrl = (image: DiscountBanner["image"]) =>
  typeof image === "object" && image !== null ? image.url : image || "";

const Field = ({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number;
  mono?: boolean;
}) => (
  <div>
    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
      {label}
    </p>
    <p
      className={`text-sm ${mono ? "font-mono" : ""} text-gray-700 dark:text-gray-200`}
    >
      {value || <span className="text-gray-300 dark:text-gray-600">—</span>}
    </p>
  </div>
);

const DiscountBannerView = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const {
    data: banner,
    isLoading,
    isError,
  } = useQuery<DiscountBanner>({
    queryKey: ["discount-banner", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/discount-banner/single-discountbanner/${slug}`,
      );
      return data?.data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <>
        <PageMeta
          title="View Discount Banner | Admin Dashboard"
          description=""
        />
        <PageBreadcrumb pageTitle="View Discount Banner" />
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (isError || !banner) {
    return (
      <>
        <PageMeta
          title="View Discount Banner | Admin Dashboard"
          description=""
        />
        <PageBreadcrumb pageTitle="View Discount Banner" />
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-500 font-semibold">Banner not found.</p>
          <button
            onClick={() => navigate("/discount-banner-list")}
            className="px-5 py-2 rounded-xl bg-accent-500 text-white text-sm font-bold"
          >
            Back to List
          </button>
        </div>
      </>
    );
  }

  const imgUrl = getImageUrl(banner.image);

  return (
    <>
      <PageMeta
        title={`${banner.title} | Discount Banner`}
        description={banner.description}
      />
      <PageBreadcrumb pageTitle="View Discount Banner" />

      <div className="space-y-6">
        {/* Header actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/discount-banner-list")}
            className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-accent-500 dark:hover:text-accent-400 transition-colors"
          >
            <FaArrowLeft className="size-3.5" />
            Back to List
          </button>
          <Button
            onClick={() => navigate(`/update-discount-banner/${banner.slug}`)}
            className="flex items-center gap-2 !bg-accent-500 hover:!bg-accent-600 !text-white px-5 py-2 !rounded-xl text-sm font-semibold"
          >
            <FaEdit className="size-3.5" />
            Edit Banner
          </Button>
        </div>

        {/* Full-width banner image */}
        {imgUrl ? (
          <div className="w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-theme-md bg-gray-50 dark:bg-gray-800">
            <img
              src={imgUrl}
              alt={banner.title}
              className="w-full max-h-[480px] object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-48 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
            No image uploaded
          </div>
        )}

        {/* Detail card — full width */}
        <div className="w-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-theme-sm p-6 space-y-6">
          {/* Title + headline */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {banner.title}
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 mt-1">
              {banner.headLine}
            </p>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Description */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
              Description
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
              {banner.description}
            </p>
          </div>

          <div className="h-px bg-gray-100 dark:bg-gray-800" />

          {/* Grid of meta fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                Redirect Link
              </p>
              {banner.link ? (
                <a
                  href={banner.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-accent-500 hover:text-accent-600 hover:underline break-all"
                >
                  {banner.link}
                  <FaExternalLinkAlt className="size-3 shrink-0" />
                </a>
              ) : (
                <span className="text-gray-300 dark:text-gray-600 text-sm">
                  —
                </span>
              )}
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                Priority
              </p>
              <span className="inline-flex items-center justify-center size-8 rounded-full bg-accent-50 dark:bg-accent-500/10 text-accent-600 dark:text-accent-400 text-sm font-bold">
                {banner.priority}
              </span>
            </div>

            <Field label="Slug" value={banner.slug} mono />

            <Field
              label="Created At"
              value={
                banner.createdAt
                  ? new Date(banner.createdAt).toLocaleString()
                  : undefined
              }
            />
            <Field
              label="Updated At"
              value={
                banner.updatedAt
                  ? new Date(banner.updatedAt).toLocaleString()
                  : undefined
              }
            />

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                Image Status
              </p>
              {typeof banner.image === "object" && banner.image !== null ? (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase
                    ${
                      banner.image.status === "uploaded"
                        ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                        : banner.image.status === "pending" ||
                            banner.image.status === "processing"
                          ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                >
                  {banner.image.status}
                </span>
              ) : (
                <span className="text-gray-300 dark:text-gray-600 text-sm">
                  —
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DiscountBannerView;
