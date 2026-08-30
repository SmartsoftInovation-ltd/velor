import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import Input from "../../form/input/InputField";
import { Link } from "react-router";
import { Modal } from "../../ui/modal";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { MdDelete } from "react-icons/md";
import {
  FaEdit,
  FaToggleOn,
  FaToggleOff,
  FaSearch,
  FaTimes,
  FaEye,
  FaRulerCombined,
} from "react-icons/fa";
import { useVirtualizer } from "@tanstack/react-virtual";
import { usePermission } from "../../../hooks/usePermission";
import useIsMobile from "../../../hooks/useIsMobile";
import MobileCardList from "../../common/MobileCardList";
import MobileCardRow from "../../common/MobileCardRow";
import { showApiError } from "../../../utils/apiError";

// ---------- Types ----------
type ApplicableLevel =
  | "category"
  | "subCategory"
  | "product"
  | "variant"
  | "brand";
type UnitType = "inch" | "cm" | "mm" | "kg" | "lbs" | "ml" | "l" | "unitless";
type Visibility = "public" | "internal" | "draft";

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

interface ApplicableItem { _id: string; name: string; slug?: string; }

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
  visibility: Visibility;
  isActive: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SizeChartTableProps {
  sizeCharts: SizeChart[] | null;
  fetchSizeCharts: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

// Portal Tooltip
const Tooltip = ({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) => {
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
    <div
      ref={ref}
      className="inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible &&
        createPortal(
          <div
            className="fixed z-99999 pointer-events-none"
            style={{
              left: coords.x,
              top: coords.y - 8,
              transform: "translate(-50%, -100%)",
            }}
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

const visibilityStyle: Record<Visibility, string> = {
  public:   "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  internal: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  draft:    "bg-yellow-50 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400",
};

const levelStyle: Record<ApplicableLevel, string> = {
  category:    "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  subCategory: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
  product:     "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  variant:     "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
  brand:       "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400",
};

export default function SizeChartTable({
  sizeCharts,
  fetchSizeCharts,
  searchTerm,
  setSearchTerm,
}: SizeChartTableProps) {
  const canAdd    = usePermission("size-chart", "add");
  const canEdit   = usePermission("size-chart", "edit");
  const canDelete = usePermission("size-chart", "delete");
  const canToggle = usePermission("size-chart", "toggle");
  const [selectedChart, setSelectedChart] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    slug: string;
    currentStatus: boolean;
  } | null>(null);
  const [togglePending, setTogglePending] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const tableData = sizeCharts || [];

  const rowVirtualizer = useVirtualizer({
    count: tableData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  });

  const gridTemplateColumns = "70px 2fr 130px 1.5fr 70px 70px 110px 120px 200px";

  const getApplicableItems = (chart: SizeChart): ApplicableItem[] => {
    switch (chart.applicableLevel) {
      case "category":    return chart.applicableCategories ?? [];
      case "subCategory": return chart.applicableSubCategories ?? [];
      case "product":     return chart.applicableProducts ?? [];
      case "variant":     return chart.applicableVariants ?? [];
      case "brand":       return chart.applicableBrands ?? [];
      default:            return [];
    }
  };

  const handleDeleteModal = (slug: string) => {
    setSelectedChart(slug);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedChart(null);
  };

  const handleDelete = async () => {
    try {
      await axiosSecure.delete(`/sizechart/delete-sizechart/${selectedChart}`);
      toast.success("Size chart deleted successfully.");
      fetchSizeCharts();
    } catch (error) {
      showApiError(error, "Failed to delete size chart. Please try again.");
    } finally {
      setShowDeleteModal(false);
      setSelectedChart(null);
    }
  };

  const handleToggleModal = (slug: string, currentStatus: boolean) => {
    setPendingToggle({ slug, currentStatus });
    setShowToggleModal(true);
  };

  const handleToggleStatus = async () => {
    if (!pendingToggle) return;
    setTogglePending(true);
    try {
      const { slug, currentStatus } = pendingToggle;
      const endpoint = currentStatus
        ? `/sizechart/update-sizechart/${slug}/deactivate`
        : `/sizechart/update-sizechart/${slug}/activate`;
      await axiosSecure.put(endpoint);
      toast.success(
        `Size chart ${!currentStatus ? "activated" : "deactivated"} successfully.`,
      );
      fetchSizeCharts();
    } catch (error) {
      showApiError(error, "Failed to update status.");
    } finally {
      setShowToggleModal(false);
      setPendingToggle(null);
      setTogglePending(false);
    }
  };

  return (
    <div className="w-full">
      {/* ── Search ── */}
      <div className="mb-5">
        <div className="w-full max-w-md relative group">
          <Input
            placeholder="Search size charts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 w-full rounded-lg pl-9 pr-9 transition-colors"
          />
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 transition-colors group-focus-within:text-[#1D4ED8]" />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 transition-colors hover:text-red-500"
            >
              <FaTimes className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {isMobile ? (
        <MobileCardList
          items={tableData}
          getKey={(chart) => chart._id}
          emptyMessage={
            searchTerm ? "No matching size charts" : "No size charts yet"
          }
          renderCard={(chart, index) => (
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs text-gray-400">#{index + 1}</span>
                  <h3 className="font-bold text-sm text-gray-800 dark:text-white/90">
                    {chart.name ?? "—"}
                  </h3>
                </div>
                <Badge
                  size="sm"
                  variant="solid"
                  color={chart.isActive ? "success" : "error"}
                  className="min-w-18.75 font-black text-[10px] uppercase shadow-md"
                >
                  {chart.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <MobileCardRow label="Level">
                <span className={`text-[10px] font-bold capitalize px-2.5 py-1 rounded-lg ${levelStyle[chart.applicableLevel]}`}>
                  {chart.applicableLevel}
                </span>
              </MobileCardRow>
              <MobileCardRow label="Cols">{chart.columns?.length ?? 0}</MobileCardRow>
              <MobileCardRow label="Rows">{chart.rows?.length ?? 0}</MobileCardRow>
              <MobileCardRow label="Visibility">
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${visibilityStyle[chart.visibility]}`}>
                  {chart.visibility}
                </span>
              </MobileCardRow>
              <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                <Link to={`/sizechart-view/${chart.slug}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="max-md:size-11 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                  >
                    <FaEye className="size-4" />
                  </Button>
                </Link>
                {canToggle && (
                  <Button
                    onClick={() => handleToggleModal(chart.slug, chart.isActive)}
                    disabled={togglePending}
                    size="sm"
                    variant="outline"
                    className={`max-md:size-11 p-0 rounded-2xl transition-all active:scale-90 border-none ${
                      chart.isActive
                        ? "text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15"
                        : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                    }`}
                  >
                    {chart.isActive ? (
                      <FaToggleOn className="size-7" />
                    ) : (
                      <FaToggleOff className="size-7" />
                    )}
                  </Button>
                )}
                {canEdit && (
                  <Link to={`/update-sizechart/${chart.slug}`}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="max-md:size-11 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                    >
                      <FaEdit className="size-4" />
                    </Button>
                  </Link>
                )}
                {canDelete && (
                  <Button
                    onClick={() => handleDeleteModal(chart.slug)}
                    size="sm"
                    className="max-md:size-11 p-0 rounded-2xl bg-red-500 hover:bg-red-600 dark:bg-red-500/80 dark:hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
                  >
                    <MdDelete className="size-5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        />
      ) : (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3 overflow-hidden shadow-theme-sm">
        <div
          ref={parentRef}
          className="no-scrollbar max-w-full overflow-auto max-h-162.5"
          style={{ minHeight: "500px" }}
        >
          <Table className="w-full min-w-275">
            <TableHeader className="sticky top-0 z-30 bg-gray-50/95 dark:bg-gray-800/95 border-b border-gray-200 dark:border-white/5 backdrop-blur-md">
              <TableRow className="grid" style={{ gridTemplateColumns }}>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  S/N
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  Name
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  Applicable Level
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  Applicable
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  Cols
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  Rows
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  Visibility
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-4 py-5 font-bold text-gray-500 text-center text-[11px] uppercase dark:text-gray-400 flex items-center justify-center"
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHeader>

            <TableBody
              className="relative w-full"
              style={{
                // Empty state fills the scroll box (500px min-height less the
                // header row) so its message sits dead centre.
                height:
                  tableData.length === 0
                    ? "440px"
                    : `${rowVirtualizer.getTotalSize()}px`,
              }}
            >
              {tableData.length === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <div className="relative">
                    <span className="absolute inset-0 rounded-full bg-[#1D4ED8]/10 blur-md" />
                    <span className="relative flex size-14 items-center justify-center rounded-full border border-dashed border-[#1D4ED8]/30 bg-[#DCE8FF] text-[#1D4ED8] dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300">
                      {searchTerm ? (
                        <FaSearch className="size-5" />
                      ) : (
                        <FaRulerCombined className="size-5" />
                      )}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                      {searchTerm ? "No matching size charts" : "No size charts yet"}
                    </p>
                    <p className="mt-0.5 max-w-xs text-xs text-gray-400 dark:text-gray-500">
                      {searchTerm ? (
                        <>
                          Nothing matched{" "}
                          <span className="font-bold text-[#1D4ED8] dark:text-blue-400">
                            "{searchTerm}"
                          </span>
                          . Try a different term.
                        </>
                      ) : (
                        "Create your first size chart to get started."
                      )}
                    </p>
                  </div>

                  {searchTerm ? (
                    <Button
                      onClick={() => setSearchTerm("")}
                      className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded"
                    >
                      Clear Search
                    </Button>
                  ) : (
                    canAdd && (
                      <Link to="/create-sizechart">
                        <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
                          Create Size Chart
                        </Button>
                      </Link>
                    )
                  )}
                </div>
              ) : (
                rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const chart = tableData[virtualRow.index];
                  if (!chart) return null;
                  return (
                    <TableRow
                      key={chart._id}
                      className="absolute top-0 left-0 w-full grid hover:bg-gray-50 dark:hover:bg-white/2 transition-colors border-b border-gray-100 dark:border-white/5 hover:z-20"
                      style={{
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                        gridTemplateColumns,
                      }}
                    >
                      <TableCell className="px-4 py-3 text-theme-sm text-gray-500 dark:text-gray-400 flex items-center justify-center font-medium">
                        #{virtualRow.index + 1}
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center text-center">
                        <Tooltip text={chart.name ?? ""}>
                          <span className="font-bold text-sm text-gray-800 dark:text-white/90 truncate max-w-40">
                            {(chart.name ?? "").length > 22
                              ? `${(chart.name ?? "").substring(0, 22)}...`
                              : (chart.name ?? "—")}
                          </span>
                        </Tooltip>
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <span className={`text-[10px] font-bold capitalize px-2.5 py-1 rounded-lg ${levelStyle[chart.applicableLevel]}`}>
                          {chart.applicableLevel}
                        </span>
                      </TableCell>

                      <TableCell className="px-3 py-3 flex items-center justify-center">
                        {(() => {
                          const items = getApplicableItems(chart);
                          if (items.length === 0) {
                            return <span className="text-xs text-gray-400">—</span>;
                          }
                          const visible = items.slice(0, 2);
                          const extra = items.length - 2;
                          return (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {visible.map((item) => {
                                const label = item.name ?? "";
                                return (
                                  <Tooltip key={item._id} text={label}>
                                    <span className="text-[10px] font-semibold bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-md truncate max-w-20">
                                      {label.length > 10 ? `${label.substring(0, 10)}…` : label || "—"}
                                    </span>
                                  </Tooltip>
                                );
                              })}
                              {extra > 0 && (
                                <Tooltip text={items.slice(2).map((i) => i.name ?? "").join(", ")}>
                                  <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md">
                                    +{extra}
                                  </span>
                                </Tooltip>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                          {chart.columns?.length ?? 0}
                        </span>
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                          {chart.rows?.length ?? 0}
                        </span>
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <span
                          className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${visibilityStyle[chart.visibility]}`}
                        >
                          {chart.visibility}
                        </span>
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center">
                        <Badge
                          size="sm"
                          variant="solid"
                          color={chart.isActive ? "success" : "error"}
                          className="min-w-18.75 font-black text-[10px] uppercase shadow-md"
                        >
                          {chart.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell className="px-4 py-3 flex items-center justify-center gap-2">
                        {/* View */}
                        <Tooltip text="View details">
                          <Link to={`/sizechart-view/${chart.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                            >
                              <FaEye className="size-4" />
                            </Button>
                          </Link>
                        </Tooltip>

                        {/* Toggle Status */}
                        {canToggle && (
                        <Tooltip
                          text={chart.isActive ? "Deactivate" : "Activate"}
                        >
                          <Button
                            onClick={() =>
                              handleToggleModal(chart.slug, chart.isActive)
                            }
                            disabled={togglePending}
                            size="sm"
                            variant="outline"
                            className={`size-10 p-0 rounded-2xl transition-all active:scale-90 border-none ${
                              chart.isActive
                                ? "text-green-500 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/15"
                                : "text-red-400 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/15"
                            }`}
                          >
                            {chart.isActive ? (
                              <FaToggleOn className="size-7" />
                            ) : (
                              <FaToggleOff className="size-7" />
                            )}
                          </Button>
                        </Tooltip>
                        )}

                        {/* Edit */}
                        {canEdit && (
                        <Tooltip text="Edit size chart">
                          <Link to={`/update-sizechart/${chart.slug}`}>
                            <Button
                              size="sm"
                              variant="outline"
                                className="size-10 p-0 rounded-2xl border-gray-200 dark:border-gray-700 text-gray-500 dark:text-[#1D4ED8] hover:text-[#1D4ED8] dark:hover:text-[#1D4ED8] dark:bg-[#DCE8FF]/5 transition-all active:scale-90"
                            >
                              <FaEdit className="size-4" />
                            </Button>
                          </Link>
                        </Tooltip>
                        )}

                        {/* Delete */}
                        {canDelete && (
                        <Tooltip text="Delete size chart">
                          <Button
                            onClick={() => handleDeleteModal(chart.slug)}
                            size="sm"
                            className="size-10 p-0 rounded-2xl bg-red-500 hover:bg-red-600 dark:bg-red-500/80 dark:hover:bg-red-500 text-white shadow-lg shadow-red-500/20 border-none transition-all active:scale-90"
                          >
                            <MdDelete className="size-5" />
                          </Button>
                        </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={closeDeleteModal}>
        <div className="p-8">
          <div className="flex items-center justify-center size-16 bg-red-50 dark:bg-red-500/10 rounded-full mb-5 mx-auto">
            <MdDelete className="size-8 text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            Delete Size Chart?
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span className="font-semibold text-red-500">delete</span> this size
            chart? This action cannot be undone.
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={closeDeleteModal}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
                className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 shadow-lg transition-all"
            >
              Yes, Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toggle Status Modal */}
      <Modal
        isOpen={showToggleModal}
        onClose={() => {
          setShowToggleModal(false);
          setPendingToggle(null);
        }}
      >
        <div className="p-8">
          <div
            className={`flex items-center justify-center size-16 rounded-full mb-5 mx-auto ${
              pendingToggle?.currentStatus
                ? "bg-red-50 dark:bg-red-500/10"
                : "bg-green-50 dark:bg-green-500/10"
            }`}
          >
            {pendingToggle?.currentStatus ? (
              <FaToggleOn className="size-8 text-red-500" />
            ) : (
              <FaToggleOff className="size-8 text-green-500" />
            )}
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center">
            {pendingToggle?.currentStatus
              ? "Deactivate Size Chart?"
              : "Activate Size Chart?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center leading-relaxed">
            Are you sure you want to{" "}
            <span
              className={`font-semibold ${
                pendingToggle?.currentStatus ? "text-red-500" : "text-green-500"
              }`}
            >
              {pendingToggle?.currentStatus ? "deactivate" : "activate"}
            </span>{" "}
            this size chart?
          </p>
          <div className="flex gap-3 mt-7">
            <Button
              onClick={() => {
                setShowToggleModal(false);
                setPendingToggle(null);
              }}
              variant="outline"
              className="flex-1 rounded-xl py-2.5 text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleToggleStatus}
              disabled={togglePending}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all ${
                pendingToggle?.currentStatus
 ?"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
 :"bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-lg"
              }`}
            >
              {pendingToggle?.currentStatus
                ? "Yes, Deactivate"
                : "Yes, Activate"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
