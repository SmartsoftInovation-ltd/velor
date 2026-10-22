import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { FaEdit, FaArrowLeft, FaExternalLinkAlt } from "react-icons/fa";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import axiosSecure from "../../../hooks/useAxiosSecure";
import Button from "../../../components/ui/button/Button";

interface Banner {
  _id: string;
  slug: string;
  title: string;
  headLine: string;
  description: string;
  link: string;
  priority: number;
  image: { url: string; status: string } | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const getImageUrl = (image: Banner["image"]) =>
  typeof image === "object" && image !== null ? image.url : image || "";

// One row of the details list: label on the left, value on the right
const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-6 py-3 first:pt-0 last:pb-0">
    <dt className="shrink-0 text-sm text-gray-500 dark:text-gray-400">{label}</dt>
    <dd className="min-w-0 text-right text-sm font-medium text-gray-800 dark:text-gray-200">{children}</dd>
  </div>
);

const Empty = () => <span className="text-gray-300 dark:text-gray-600">—</span>;

const IMAGE_STATUS: Record<string, string> = {
  uploaded: "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400",
  pending: "bg-warning-50 text-warning-700 ring-warning-500/20 dark:bg-warning-500/15 dark:text-warning-400",
  processing: "bg-warning-50 text-warning-700 ring-warning-500/20 dark:bg-warning-500/15 dark:text-warning-400",
  failed: "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400",
};

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

const BannerView = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const { data: banner, isLoading, isError } = useQuery<Banner>({
    queryKey: ["banner", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/banner/single-banner/${slug}`);
      return data?.data?.banner ?? data?.data;
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <>
        <PageMeta title="View Banner | Admin Dashboard" description="" />
        <PageBreadcrumb pageTitle="View Banner" />
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (isError || !banner) {
    return (
      <>
        <PageMeta title="View Banner | Admin Dashboard" description="" />
        <PageBreadcrumb pageTitle="View Banner" />
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <p className="text-red-500 font-semibold">Banner not found.</p>
          <button
            onClick={() => navigate("/banner-list")}
            className="px-5 py-2 rounded-xl bg-accent-500 text-white text-sm font-bold"
          >
            Back to List
          </button>
        </div>
      </>
    );
  }

  const imgUrl = getImageUrl(banner.image);
  const imageStatus = typeof banner.image === "object" && banner.image !== null ? banner.image.status : "";

  return (
    <>
      <PageMeta title={`${banner.title} | Banner`} description={banner.description} />
      <PageBreadcrumb pageTitle="View Banner" />

      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/banner-list")}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-accent-600 dark:text-gray-400 dark:hover:text-accent-400"
        >
          <FaArrowLeft className="size-3.5" />
          Back to list
        </button>
        <Button
          onClick={() => navigate(`/update-banner/${banner.slug}`)}
          className="flex items-center gap-2 !rounded-xl !bg-accent-500 px-5 py-2 text-sm font-semibold !text-white hover:!bg-accent-600"
        >
          <FaEdit className="size-3.5" />
          Edit banner
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Left: the banner as shoppers see it */}
        <section className="lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs lg:sticky lg:top-24 dark:border-gray-800 dark:bg-white/[0.03]">
            {imgUrl ? (
              // Whole image, never cropped; a blurred copy fills any space around it
              <div className="relative aspect-[16/9] bg-gray-900">
                <img src={imgUrl} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl" />
                <img src={imgUrl} alt={banner.title} className="relative size-full object-contain" />
              </div>
            ) : (
              <div className="flex aspect-[16/9] items-center justify-center border-b border-dashed border-gray-200 text-sm text-gray-400 dark:border-gray-700">
                No image uploaded yet
              </div>
            )}
            <p className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">
              {banner.isActive
                ? `Shown on the home page slider in position ${banner.priority}.`
                : "Hidden from the home page until you activate it."}
            </p>
          </div>
        </section>

        {/* Right: content and settings */}
        <div className="space-y-5 lg:col-span-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">{banner.title}</h1>
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                  banner.isActive
                    ? "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
                    : "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400"
                }`}
              >
                <span className={`size-1.5 rounded-full ${banner.isActive ? "animate-pulse bg-accent-500" : "bg-error-500"}`} />
                {banner.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            {banner.headLine && (
              <p className="mt-1.5 text-base text-gray-600 dark:text-gray-300">{banner.headLine}</p>
            )}
            {banner.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {banner.description}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white/90">Details</h2>
            <dl className="divide-y divide-gray-100 dark:divide-gray-800">
              <DetailRow label="Opens">
                {banner.link ? (
                  <a
                    href={banner.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 break-all text-accent-600 hover:underline dark:text-accent-400"
                  >
                    {banner.link}
                    <FaExternalLinkAlt className="size-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-gray-500">The shop page</span>
                )}
              </DetailRow>
              <DetailRow label="Priority">{banner.priority}</DetailRow>
              <DetailRow label="Image">
                {imageStatus ? (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${IMAGE_STATUS[imageStatus] ?? IMAGE_STATUS.failed}`}>
                    {imageStatus}
                  </span>
                ) : (
                  <Empty />
                )}
              </DetailRow>
              <DetailRow label="Slug">
                <code className="font-mono text-xs text-gray-600 dark:text-gray-300">{banner.slug}</code>
              </DetailRow>
              <DetailRow label="Created">{formatDate(banner.createdAt) || <Empty />}</DetailRow>
              <DetailRow label="Last updated">{formatDate(banner.updatedAt) || <Empty />}</DetailRow>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
};

export default BannerView;
