import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axiosSecure from "../../hooks/useAxiosSecure";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Loader from "../../components/common/Loader";
import Button from "../../components/ui/button/Button";
import Badge from "../../components/ui/badge/Badge";
import { Modal } from "../../components/ui/modal";
import toast from "react-hot-toast";
import moment from "moment";
import { showApiError } from "../../utils/apiError";
import {
  FaEdit,
  FaToggleOn,
  FaToggleOff,
  FaArrowLeft,
  FaLink,
  FaIdCard,
  FaVideo,
  FaTable,
  FaCheckCircle,
  FaTimesCircle,
  FaLayerGroup,
  FaTags,
} from "react-icons/fa";

// ---------- Types ----------
type ApplicableLevel =
  | "category"
  | "subCategory"
  | "product"
  | "variant"
  | "brand";
type UnitType = "inch" | "cm" | "mm" | "kg" | "lbs" | "ml" | "l" | "unitless";

interface Column {
  key: string;
  label: string;
  unit: UnitType;
  order: number;
}

interface Row {
  label: string;
  values: string[];
  order: number;
}

interface ApplicableItem {
  _id: string;
  name: string;
  slug?: string;
}

interface SizeChart {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  applicableLevel: ApplicableLevel;
  applicableCategories: ApplicableItem[];
  applicableSubCategories: ApplicableItem[];
  applicableProducts: ApplicableItem[];
  applicableVariants: ApplicableItem[];
  applicableBrands: ApplicableItem[];
  columns: Column[];
  rows: Row[];
  sizeLabels: string[];
  minSize: string;
  maxSize: string;
  videoUrl?: string;
  isActive: boolean;
  viewCount: number;
  usageCount?: number;
  createdAt: string;
  updatedAt: string;
}

const levelStyle: Record<ApplicableLevel, string> = {
  category:    "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  subCategory: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
  product:     "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  variant:     "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  brand:       "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400",
};

// Portal Tooltip
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
        <div
          className="fixed z-99999 pointer-events-none"
          style={{ left: coords.x, top: coords.y - 8, transform: "translate(-50%, -100%)" }}
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

const getApplicableItems = (chart: SizeChart): ApplicableItem[] => {
  switch (chart.applicableLevel) {
    case "category":    return chart.applicableCategories;
    case "subCategory": return chart.applicableSubCategories;
    case "product":     return chart.applicableProducts;
    case "variant":     return chart.applicableVariants;
    case "brand":       return chart.applicableBrands;
    default:            return [];
  }
};

const SizeChartView = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const { data: sizeChart, isLoading, isError, refetch } = useQuery({
    queryKey: ["sizeChart-detail", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/sizechart/get-sizechart/${slug}`);
      return data.data.sizeChart as SizeChart;
    },
    enabled: !!slug,
  });

  const handleToggleStatus = async () => {
    // Guard against a second click while the first request is still running.
    if (isToggling) return;
    if (!sizeChart) return;
    setIsToggling(true);
    try {
      const endpoint = sizeChart.isActive
        ? `/sizechart/update-sizechart/${sizeChart.slug}/deactivate`
        : `/sizechart/update-sizechart/${sizeChart.slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(`Size chart ${sizeChart.isActive ? "deactivated" : "activated"} successfully.`);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["sizeCharts"] });
    } catch (error) {
      showApiError(error, "Failed to update status.");
    } finally {
      setIsToggling(false);
      setShowConfirmModal(false);
    }
  };

  const applicableItems = sizeChart ? getApplicableItems(sizeChart) : [];

  return (
    <>
      <PageMeta
        title={`View Size Chart - ${sizeChart?.name ?? "Loading..."}`}
        description="Size chart details view"
      />
      <PageBreadcrumb pageTitle="Size Chart Details" />

      <div className="space-y-6 mt-10">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full flex-wrap gap-3">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white/90 tracking-tight">
                Size Chart Information
              </h2>
              <div className="flex items-center gap-2">
                <Tooltip text="Go back">
                  <Button
                    onClick={() => navigate(-1)}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 rounded-xl px-4 py-2 border-gray-200 dark:border-gray-700 transition-all active:scale-90"
                  >
                    <FaArrowLeft className="size-3.5" />
                    Back
                  </Button>
                </Tooltip>

                {sizeChart && (
                  <>
                    <Tooltip text="Edit size chart">
                      <Link to={`/update-sizechart/${sizeChart.slug}`}>
                        <Button
                          size="sm"
                            className="flex items-center gap-2 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl px-4 py-2 shadow-lg font-bold"
                        >
                          <FaEdit className="size-3.5" />
                          Edit
                        </Button>
                      </Link>
                    </Tooltip>

                    {sizeChart.isActive ? (
                      <Tooltip text="Deactivate this size chart">
                        <Button
                          onClick={() => setShowConfirmModal(true)}
                          size="sm"
                          className="flex items-center gap-2 rounded-xl px-4 py-2 shadow-lg border-none bg-red-500 hover:bg-red-600 text-white shadow-red-500/20 font-bold"
                        >
                          <FaToggleOn className="size-4" />
                          Deactivate
                        </Button>
                      </Tooltip>
                    ) : (
                      <Tooltip text="Activate this size chart">
                        <Button
                          onClick={() => setShowConfirmModal(true)}
                          size="sm"
                          className="flex items-center gap-2 rounded-xl px-4 py-2 shadow-lg border-none bg-green-500 hover:bg-green-600 text-white shadow-green-500/20 font-bold"
                        >
                          <FaToggleOff className="size-4" />
                          Activate
                        </Button>
                      </Tooltip>
                    )}
                  </>
                )}
              </div>
            </div>
          }
        >
          {isLoading ? (
            <div className="flex justify-center items-center min-h-[400px]">
              <Loader />
            </div>
          ) : isError || !sizeChart ? (
            <div className="text-center py-20 min-h-[400px]">
              <p className="text-red-500 font-bold mb-4">Size chart not found!</p>
              <Button size="sm" variant="outline" onClick={() => navigate(-1)} className="rounded-xl">
                Go Back
              </Button>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-500 p-2">

              {/* ── Basic Info Grid ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 hover:border-brand-500/30 transition-all sm:col-span-2">
                  <p className="text-[10px] uppercase font-medium text-gray-400 mb-2">Name</p>
                  <p className="text-2xl font-bold text-gray-800 dark:text-white tracking-tight">
                    {sizeChart.name}
                  </p>
                  <div className="mt-3">
                    <Badge
                      variant="solid"
                      size="sm"
                      color={sizeChart.isActive ? "success" : "error"}
                      className="uppercase font-black tracking-widest text-[10px] px-4 py-1.5 rounded-full shadow-lg"
                    >
                      {sizeChart.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 hover:border-brand-500/30 transition-all">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FaLink className="text-brand-500 size-3" />
                    <p className="text-[10px] uppercase font-medium text-gray-400">Slug</p>
                  </div>
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300 font-mono bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg inline-block border border-gray-100 dark:border-gray-800">
                    /{sizeChart.slug}
                  </p>
                </div>

                {sizeChart.description && (
                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 hover:border-brand-500/30 transition-all sm:col-span-2 lg:col-span-3">
                    <p className="text-[10px] uppercase font-medium text-gray-400 mb-2">Description</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {sizeChart.description}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800 hover:border-blue-500/30 transition-all sm:col-span-2 lg:col-span-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FaIdCard className="text-blue-500 size-3" />
                    <p className="text-[10px] uppercase font-medium text-gray-400">System ID</p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all selection:bg-blue-100 dark:selection:bg-blue-900/30">
                    {sizeChart._id}
                  </p>
                </div>
              </div>

              {/* ── Applicable Info ── */}
              <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[28px] p-6 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 mb-5">
                  <div className="size-9 rounded-xl bg-brand-500/10 flex items-center justify-center">
                    <FaLayerGroup className="text-brand-500 size-4" />
                  </div>
                  <h3 className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-[3px]">
                    Applicable Scope
                  </h3>
                </div>
                <div className="flex flex-wrap gap-4 items-start">
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">Level</p>
                    <span className={`text-xs font-bold capitalize px-3 py-1.5 rounded-lg ${levelStyle[sizeChart.applicableLevel]}`}>
                      {sizeChart.applicableLevel}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">
                      Applied To
                    </p>
                    {applicableItems.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">None assigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {applicableItems.map((item) => (
                          <Tooltip key={item._id} text={item._id}>
                            <span className="text-xs font-semibold bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 px-3 py-1 rounded-lg border border-brand-100 dark:border-brand-500/20">
                              {item.name}
                            </span>
                          </Tooltip>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Stats Row ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[20px] p-5 border border-gray-100 dark:border-gray-800 text-center">
                  <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">Columns</p>
                  <p className="text-3xl font-black text-gray-800 dark:text-white">{sizeChart.columns.length}</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[20px] p-5 border border-gray-100 dark:border-gray-800 text-center">
                  <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">Rows</p>
                  <p className="text-3xl font-black text-gray-800 dark:text-white">{sizeChart.rows.length}</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[20px] p-5 border border-gray-100 dark:border-gray-800 text-center">
                  <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-2">Views</p>
                  <p className="text-3xl font-black text-gray-800 dark:text-white">{sizeChart.viewCount ?? 0}</p>
                </div>
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[20px] p-5 border border-gray-100 dark:border-gray-800 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-2">
                    {sizeChart.isActive ? (
                      <FaCheckCircle className="text-green-500 size-3" />
                    ) : (
                      <FaTimesCircle className="text-red-500 size-3" />
                    )}
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">Status</p>
                  </div>
                  <p className={`text-sm font-black uppercase tracking-wide ${sizeChart.isActive ? "text-green-600" : "text-red-500"}`}>
                    {sizeChart.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
              </div>

              {/* ── Size Chart Table ── */}
              <div className="rounded-[28px] border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                  <div className="size-9 rounded-xl bg-brand-500/10 flex items-center justify-center">
                    <FaTable className="text-brand-500 size-4" />
                  </div>
                  <h3 className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-[3px]">
                    Size Chart
                  </h3>
                  <span className="ml-auto text-[10px] font-semibold text-gray-400">
                    {sizeChart.rows.length} sizes · {sizeChart.columns.length} attributes
                  </span>
                </div>

                {sizeChart.columns.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
                    No columns defined
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-white dark:bg-gray-900">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-800 dark:bg-gray-950">
                          <th className="px-5 py-4 text-left text-[11px] font-black uppercase tracking-widest text-white/70 whitespace-nowrap">
                            SIZE
                          </th>
                          {sizeChart.columns.map((col, i) => (
                            <th
                              key={i}
                              className="px-5 py-4 text-center text-[11px] font-black uppercase tracking-widest text-white/70 whitespace-nowrap"
                            >
                              <span className="block">{col.label || col.key}</span>
                              {col.unit !== "unitless" && (
                                <span className="text-[10px] font-medium text-white/40 normal-case tracking-normal">
                                  {col.unit.toUpperCase()}
                                </span>
                              )}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sizeChart.rows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={sizeChart.columns.length + 1}
                              className="px-5 py-8 text-center text-gray-400 text-sm"
                            >
                              No rows defined
                            </td>
                          </tr>
                        ) : (
                          sizeChart.rows.map((row, ri) => (
                            <tr
                              key={ri}
                              className={`border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors hover:bg-brand-50/30 dark:hover:bg-brand-500/5 ${
                                ri % 2 === 0
                                  ? "bg-white dark:bg-gray-900"
                                  : "bg-gray-50/60 dark:bg-gray-800/30"
                              }`}
                            >
                              <td className="px-5 py-3.5 font-black text-sm text-gray-800 dark:text-white whitespace-nowrap">
                                {row.label || <span className="text-gray-300 dark:text-gray-600">—</span>}
                              </td>
                              {row.values.map((val, ci) => (
                                <td
                                  key={ci}
                                  className="px-5 py-3.5 text-center text-sm text-gray-700 dark:text-gray-300"
                                >
                                  {val || <span className="text-gray-300 dark:text-gray-600">—</span>}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Video URL ── */}
              {sizeChart.videoUrl && (
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <FaVideo className="text-brand-500 size-3.5" />
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">Video Guide URL</p>
                  </div>
                  <a
                    href={sizeChart.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-500 hover:text-brand-600 font-medium break-all underline underline-offset-2"
                  >
                    {sizeChart.videoUrl}
                  </a>
                </div>
              )}

              {/* ── Size Labels ── */}
              {sizeChart.sizeLabels && sizeChart.sizeLabels.length > 0 && (
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <FaTags className="text-brand-500 size-3.5" />
                    <p className="text-[10px] uppercase font-black tracking-widest text-gray-400">Size Labels</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizeChart.sizeLabels.map((label, i) => (
                      <span
                        key={i}
                        className="text-xs font-bold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-lg"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  {(sizeChart.minSize || sizeChart.maxSize) && (
                    <div className="flex gap-6 mt-4">
                      {sizeChart.minSize && (
                        <div>
                          <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1">Min Size</p>
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{sizeChart.minSize}</p>
                        </div>
                      )}
                      {sizeChart.maxSize && (
                        <div>
                          <p className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1">Max Size</p>
                          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{sizeChart.maxSize}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Timestamps ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] uppercase font-medium text-gray-400 mb-2">Created</p>
                  <p className="text-md font-bold text-gray-700 dark:text-gray-300">
                    {moment(sizeChart.createdAt).format("MMMM DD, YYYY")}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium italic">
                    {moment(sizeChart.createdAt).fromNow()}
                  </p>
                </div>
                <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-[24px] p-6 border border-gray-100 dark:border-gray-800">
                  <p className="text-[10px] uppercase font-medium text-gray-400 mb-2">Last Updated</p>
                  <p className="text-md font-bold text-gray-700 dark:text-gray-300">
                    {moment(sizeChart.updatedAt).format("MMMM DD, YYYY")}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 font-medium italic">
                    {moment(sizeChart.updatedAt).fromNow()}
                  </p>
                </div>
              </div>

            </div>
          )}
        </ComponentCard>
      </div>

      {/* Status Confirmation Modal */}
      <Modal isOpen={showConfirmModal} onClose={() => setShowConfirmModal(false)}>
        <div className="p-8">
          <div
            className={`flex items-center justify-center size-20 rounded-[28px] mb-6 mx-auto ${
              sizeChart?.isActive
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-green-50 dark:bg-green-500/10"
            }`}
          >
            {sizeChart?.isActive ? (
              <FaToggleOn className="size-10 text-red-500" />
            ) : (
              <FaToggleOff className="size-10 text-green-500" />
            )}
          </div>

          <h2 className="text-2xl font-black text-gray-900 dark:text-white text-center tracking-tight">
            {sizeChart?.isActive ? "Deactivate Size Chart?" : "Activate Size Chart?"}
          </h2>

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span
              className={`font-black uppercase tracking-wide ${
                sizeChart?.isActive ? "text-red-500" : "text-green-500"
              }`}
            >
              {sizeChart?.isActive ? "deactivate" : "activate"}
            </span>{" "}
            <span className="font-bold text-gray-800 dark:text-gray-200">
              "{sizeChart?.name}"
            </span>
            ?
          </p>

          <div className="flex gap-4 mt-10">
            <Button
              onClick={() => setShowConfirmModal(false)}
              variant="outline"
              className="flex-1 rounded-2xl py-3 text-sm font-bold border-gray-200 dark:border-gray-700 transition-all hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              disabled={isToggling}
              className={`flex-1 rounded-2xl py-3 text-sm font-black uppercase tracking-widest border-none active:scale-95 transition-all ${
                sizeChart?.isActive
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-xl"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-xl"
              }`}
            >
              {isToggling ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                  Updating...
                </span>
              ) : (
                sizeChart?.isActive ? "Confirm Deactivation" : "Confirm Activation"
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default SizeChartView;
