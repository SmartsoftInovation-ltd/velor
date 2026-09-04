import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { FaEdit, FaEye, FaSearch, FaSync, FaTimes } from "react-icons/fa";
import { MdDelete } from "react-icons/md";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Modal } from "../../ui/modal";
import Button from "../../ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

interface DiscountBanner {
  _id: string;
  slug: string;
  title: string;
  headLine: string;
  description: string;
  link: string;
  priority: number;
  image: { url: string; status: string } | string;
}

// ---------- Tooltip ----------
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setVisible(true);
    }
  };

  return (
    <div ref={ref} className="inline-flex" onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible &&
        createPortal(
          <div
            className="fixed z-[99999] pointer-events-none"
            style={{ left: coords.x, top: coords.y, transform: "translate(-50%, -100%)" }}
          >
            <div className="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-lg whitespace-nowrap shadow-lg">
              {text}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

const getImageUrl = (image: DiscountBanner["image"]) =>
  typeof image === "object" && image !== null ? image.url : image || "";

const gridTemplateColumns = "48px 100px 1fr 1fr 1fr 80px 160px";
const COLUMNS = ["#", "Image", "Title", "Headline", "Description", "Priority", "Actions"];

const DiscountBannerTable = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<DiscountBanner | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    data: allBanners = [],
    isLoading,
    isFetching,
    isError,
    refetch,
  } = useQuery<DiscountBanner[]>({
    queryKey: ["discount-banners"],
    queryFn: async () => {
      try {
        const { data } = await axiosSecure.get("/discount-banner/all-discountbanner");
        return data?.data || [];
      } catch (err: any) {
        if (err?.response?.status === 404) return [];
        throw err;
      }
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const fetchBanners = () => {
    queryClient.invalidateQueries({ queryKey: ["discount-banners"] });
    refetch();
  };

  const banners = searchTerm.trim()
    ? allBanners.filter((b) => {
        const q = searchTerm.toLowerCase();
        return (
          b.title?.toLowerCase().includes(q) ||
          b.headLine?.toLowerCase().includes(q) ||
          b.description?.toLowerCase().includes(q)
        );
      })
    : allBanners;

  const rowVirtualizer = useVirtualizer({
    count: banners.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);
    try {
      await axiosSecure.delete(`/discount-banner/delete-discountbanner/${selected.slug}`);
      toast.success("Discount banner deleted successfully!");
      queryClient.invalidateQueries({ queryKey: ["discount-banners"] });
      fetchBanners();
    } catch (error) {
      showApiError(error, "Failed to delete discount banner.");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSelected(null);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, headline..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <FaTimes className="size-3" />
            </button>
          )}
        </div>

        <Tooltip text="Refresh">
          <button
            onClick={fetchBanners}
            disabled={isFetching}
            className="size-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-500 hover:text-brand-500 hover:border-brand-500 transition disabled:opacity-50"
          >
            <FaSync className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </Tooltip>

        <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
          {banners.length} banner{banners.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="text-center py-20 min-h-[400px]">
          <p className="text-red-500 font-bold mb-4">Failed to load discount banners!</p>
          <button
            onClick={() => refetch()}
            className="px-6 py-2 bg-brand-500 text-white rounded-xl font-bold"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && isMobile ? (
        <MobileCardList
          items={banners}
          getKey={(banner) => banner._id}
          emptyMessage="No discount banners found"
          renderCard={(banner) => (
            <div className="space-y-1">
              <div className="mb-2 flex items-center gap-3 border-b border-gray-100 pb-2 dark:border-white/[0.05]">
                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  <img
                    src={typeof banner.image === "string" ? banner.image : banner.image?.url}
                    alt={banner.title}
                    className="size-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-800 dark:text-white/90">
                    {banner.title}
                  </p>
                  <p className="truncate text-xs text-gray-400">{banner.headLine}</p>
                </div>
              </div>
              <MobileCardRow label="Priority">{banner.priority}</MobileCardRow>
              <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2 dark:border-white/[0.05]">
                <button
                  onClick={() => navigate(`/view-discount-banner/${banner.slug}`)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                >
                  <FaEye className="size-4" />
                </button>
                <button
                  onClick={() => navigate(`/update-discount-banner/${banner.slug}`)}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
                >
                  <FaEdit className="size-4" />
                </button>
                <button
                  onClick={() => { setSelected(banner); setShowDeleteModal(true); }}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-red-500 text-white"
                >
                  <MdDelete className="size-5" />
                </button>
              </div>
            </div>
          )}
        />
      ) : !isLoading && !isError ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] overflow-hidden shadow-theme-sm">
          {/* Header — outside scroll container */}
          <div
            className="grid bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700"
            style={{ gridTemplateColumns }}
          >
            {COLUMNS.map((col) => (
              <div
                key={col}
                className="px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center justify-center"
              >
                {col}
              </div>
            ))}
          </div>

          {/* Body */}
          <div
            ref={parentRef}
            className="no-scrollbar overflow-y-auto overflow-x-hidden"
            style={{ maxHeight: 650 }}
          >
            {banners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 min-h-[400px] text-gray-400 dark:text-gray-500">
                <FaSearch className="size-8 mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-sm font-medium">No banners found</p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="mt-2 text-xs text-brand-500 hover:underline"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const banner = banners[virtualRow.index];
                  const imgUrl = getImageUrl(banner.image);
                  return (
                    <div
                      key={banner._id}
                      className="absolute top-0 left-0 w-full grid items-center border-b border-gray-50 dark:border-gray-800/60 hover:bg-gray-50/70 dark:hover:bg-gray-800/30 transition-colors"
                      style={{
                        gridTemplateColumns,
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {/* # */}
                      <div className="px-4 text-xs text-gray-400 font-mono flex items-center justify-center">
                        {virtualRow.index + 1}
                      </div>

                      {/* Image */}
                      <div className="px-3 flex items-center justify-center">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={banner.title}
                            className="w-16 h-10 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                          />
                        ) : (
                          <div className="w-16 h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] text-gray-400">
                            N/A
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <div className="px-4 text-sm font-medium text-gray-800 dark:text-gray-100 truncate flex items-center justify-center">
                        {banner.title}
                      </div>

                      {/* Headline */}
                      <div className="px-4 text-sm text-gray-600 dark:text-gray-300 truncate flex items-center justify-center">
                        {banner.headLine}
                      </div>

                      {/* Description */}
                      <div className="px-4 text-xs text-gray-500 dark:text-gray-400 line-clamp-2 flex items-center justify-center">
                        {banner.description}
                      </div>

                      {/* Priority */}
                      <div className="px-4 flex items-center justify-center">
                        <span className="inline-flex items-center justify-center size-7 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-xs font-bold">
                          {banner.priority}
                        </span>
                      </div>

                      {/* Actions: View → Edit → Delete */}
                      <div className="px-4 flex items-center justify-center gap-2">
                        <Tooltip text="View">
                          <button
                            onClick={() => navigate(`/view-discount-banner/${banner.slug}`)}
                            className="size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-blue-400 hover:text-blue-500 hover:border-blue-400 transition-all active:scale-90"
                          >
                            <FaEye className="size-4" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Edit">
                          <button
                            onClick={() => navigate(`/update-discount-banner/${banner.slug}`)}
                            className="size-10 p-0 flex items-center justify-center rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-brand-400 hover:text-brand-500 hover:border-brand-400 transition-all active:scale-90"
                          >
                            <FaEdit className="size-4" />
                          </button>
                        </Tooltip>
                        <Tooltip text="Delete">
                          <button
                            onClick={() => {
                              setSelected(banner);
                              setShowDeleteModal(true);
                            }}
                            className="size-10 p-0 flex items-center justify-center rounded-2xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 transition-all active:scale-90"
                          >
                            <MdDelete className="size-5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelected(null); }}
      >
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            Delete Banner?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-red-500">{selected?.title}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => { setShowDeleteModal(false); setSelected(null); }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
                className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all"
            >
              {isDeleting ? "Deleting..." : "Yes, Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DiscountBannerTable;
