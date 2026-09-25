import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  FaArrowLeft,
  FaSync,
  FaPlus,
  FaTrashAlt,
  FaSearch,
  FaTimes,
  FaChevronDown,
  FaCheck,
  FaTable,
} from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import ComponentCard from "../common/ComponentCard";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Select from "../form/Select";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";

// ---------- Types ----------
type UnitType = "inch" | "cm" | "mm" | "kg" | "lbs" | "ml" | "l" | "unitless";
type ApplicableLevel = "category" | "subCategory" | "product" | "variant" | "brand";

interface Column { key: string; label: string; unit: UnitType; order: number; }
interface Row { label: string; values: string[]; order: number; }
interface IdOption { value: string; label: string; }

// ---------- Constants ----------
const UNIT_OPTIONS: { value: UnitType; label: string }[] = [
  { value: "unitless", label: "—" },
  { value: "inch", label: "INCH" },
  { value: "cm", label: "CM" },
  { value: "mm", label: "MM" },
  { value: "kg", label: "KG" },
  { value: "lbs", label: "LBS" },
  { value: "ml", label: "ML" },
  { value: "l", label: "L" },
];
const LEVEL_OPTIONS = [
  { value: "category", label: "Category" },
  { value: "subCategory", label: "Sub Category" },
  { value: "product", label: "Product" },
  { value: "variant", label: "Variant" },
  { value: "brand", label: "Brand" },
];
const LEVEL_LABEL: Record<ApplicableLevel, string> = {
  category: "Categories",
  subCategory: "Sub Categories",
  product: "Products",
  variant: "Variants",
  brand: "Brands",
};
const LEVEL_KEY: Record<ApplicableLevel, string> = {
  category: "applicableCategories",
  subCategory: "applicableSubCategories",
  product: "applicableProducts",
  variant: "applicableVariants",
  brand: "applicableBrands",
};

const sanitiseKey = (raw: string) =>
  raw.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");

// ---------- Tooltip ----------
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

// ---------- MultiSelect ----------
const MultiSelect = ({
  options,
  selected,
  onChange,
  placeholder,
  loading,
  error,
}: {
  options: IdOption[];
  selected: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  loading?: boolean;
  error?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );
  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((v) => v !== val)
        : [...selected, val]
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className={`w-full min-h-11 flex flex-wrap items-center gap-1.5 px-3 py-2 text-sm rounded-xl border transition-all ${
          open
            ? "border-accent-500 ring-2 ring-accent-500/20 bg-white dark:bg-gray-900"
            : error
            ? "border-red-500 bg-white dark:bg-gray-900"
            : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-accent-400"
        }`}
      >
        {selected.length === 0 ? (
          <span className="text-gray-400 flex-1 text-left">
            {loading ? "Loading..." : placeholder || "Select items..."}
          </span>
        ) : (
          <>
            {selected.map((v) => {
              const opt = options.find((o) => o.value === v);
              return (
                <span
                  key={v}
                  className="flex items-center gap-1 bg-accent-50 dark:bg-accent-500/15 text-accent-700 dark:text-accent-300 px-2 py-0.5 rounded-lg text-xs font-semibold"
                >
                  {opt?.label ?? v.slice(-6)}
                  <span
                    onClick={(e) => { e.stopPropagation(); toggle(v); }}
                    className="text-accent-400 hover:text-red-500 cursor-pointer"
                  >
                    <FaTimes className="size-2.5" />
                  </span>
                </span>
              );
            })}
            <span className="ml-auto" />
          </>
        )}
        <FaChevronDown
          className={`ml-auto size-3 text-gray-400 transition-transform shrink-0 ${
            open ? "rotate-180 text-accent-500" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-theme-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3" />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 outline-none focus:border-accent-500 transition-all placeholder:text-gray-400 dark:text-white"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-400">No results found</div>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                      checked
                        ? "bg-accent-50 dark:bg-accent-500/10 text-accent-700 dark:text-accent-300"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span
                      className={`size-4 rounded flex items-center justify-center border shrink-0 ${
                        checked ? "bg-accent-500 border-accent-500" : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {checked && <FaCheck className="size-2.5 text-white" />}
                    </span>
                    {opt.label}
                  </button>
                );
              })
            )}
          </div>
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex items-center justify-between">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              {selected.length} selected · {filtered.length} results
            </p>
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="text-[10px] text-red-500 hover:text-red-600 font-medium"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Main component ----------
const SizeChartUpdate = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [applicableLevel, setApplicableLevel] = useState<ApplicableLevel>("category");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [applicableOptions, setApplicableOptions] = useState<IdOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [columns, setColumns] = useState<Column[]>([
    { key: "size", label: "Size", unit: "unitless", order: 0 },
  ]);
  const [rows, setRows] = useState<Row[]>([
    { label: "S", values: ["S"], order: 0 },
  ]);
  const [videoUrl, setVideoUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ---------- Fetch sizeChart ----------
  const { data: sizeChart, isLoading: isFetching } = useQuery({
    queryKey: ["sizeChart", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/sizechart/get-sizechart/${slug}`);
      return data.data.sizeChart;
    },
    enabled: !!slug,
  });

  // ---------- Populate form ----------
  useEffect(() => {
    if (!sizeChart) return;
    setName(sizeChart.name || "");
    setDescription(sizeChart.description || "");
    const level: ApplicableLevel = sizeChart.applicableLevel || "category";
    setApplicableLevel(level);
    setColumns(
      sizeChart.columns?.length
        ? sizeChart.columns
        : [{ key: "size", label: "Size", unit: "unitless", order: 0 }]
    );
    setRows(
      sizeChart.rows?.length
        ? sizeChart.rows
        : [{ label: "S", values: ["S"], order: 0 }]
    );
    setVideoUrl(sizeChart.videoUrl || "");

    const idKey = LEVEL_KEY[level] as keyof typeof sizeChart;
    const rawItems = (sizeChart[idKey] as Array<{ _id: string } | string>) || [];
    setSelectedIds(rawItems.map((item) => (typeof item === "string" ? item : item._id)));
  }, [sizeChart]);

  // ---------- Fetch applicable options ----------
  useEffect(() => {
    const load = async () => {
      setOptionsLoading(true);
      setApplicableOptions([]);
      try {
        if (applicableLevel === "category") {
          const { data } = await axiosSecure.get("/categories");
          setApplicableOptions(
            (data.data.categories || []).map((c: { _id: string; name: string }) => ({
              value: c._id,
              label: c.name,
            }))
          );
        } else if (applicableLevel === "subCategory") {
          const { data } = await axiosSecure.get("/categories");
          const cats: { name: string; subcategories?: { _id: string; name: string }[] }[] =
            data.data.categories || [];
          const subs = cats.flatMap((c) =>
            (c.subcategories || []).map((s) => ({
              value: s._id,
              label: `${s.name} (${c.name})`,
            }))
          );
          setApplicableOptions(subs);
        } else if (applicableLevel === "brand") {
          const { data } = await axiosSecure.get("/brand");
          setApplicableOptions(
            (data.data.brands || []).map((b: { _id: string; name: string }) => ({
              value: b._id,
              label: b.name,
            }))
          );
        } else if (applicableLevel === "product") {
          const res = await axiosSecure.get("/product/getproduct");
          const all: { _id: string; name: string; variantType?: string }[] =
            res.data?.data?.products || res.data?.data || [];
          setApplicableOptions(
            all
              .filter((p) => p.variantType === "singleVariant")
              .map((p) => ({ value: p._id, label: p.name }))
          );
        } else if (applicableLevel === "variant") {
          const res = await axiosSecure.get("/variant");
          const all: { _id: string; variantName?: string; product?: { name: string } }[] = res.data?.data?.variants || res.data?.data || [];
          setApplicableOptions(all.map((p) => ({ value: p._id, label: p.variantName ? `${p.product?.name || 'Product'} - ${p.variantName}` : (p.product?.name || 'Unknown Variant') })));
        }
      } catch {
        setApplicableOptions([]);
      } finally {
        setOptionsLoading(false);
      }
    };
    load();
  }, [applicableLevel]);

  // ---------- Column helpers ----------
  const addColumn = () => {
    if (columns.length >= 10) return;
    setColumns((prev) => [
      ...prev,
      { key: "", label: "", unit: "unitless", order: prev.length },
    ]);
    setRows((prev) => prev.map((r) => ({ ...r, values: [...r.values, ""] })));
  };

  const removeColumn = (i: number) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, idx) => idx !== i));
    setRows((prev) =>
      prev.map((r) => ({ ...r, values: r.values.filter((_, idx) => idx !== i) }))
    );
  };

  const updateColumnLabel = (i: number, label: string) => {
    setColumns((prev) =>
      prev.map((col, idx) =>
        idx === i ? { ...col, label, key: sanitiseKey(label) } : col
      )
    );
    if (errors[`col_label_${i}`]) setErrors((p) => ({ ...p, [`col_label_${i}`]: "" }));
  };

  const updateColumnUnit = (i: number, unit: string) =>
    setColumns((prev) =>
      prev.map((col, idx) => (idx === i ? { ...col, unit: unit as UnitType } : col))
    );

  // ---------- Row helpers ----------
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { label: "", values: Array(columns.length).fill(""), order: prev.length },
    ]);

  const removeRow = (i: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  };

  const updateRowLabel = (i: number, val: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, label: val } : r)));
    if (errors[`row_label_${i}`]) setErrors((p) => ({ ...p, [`row_label_${i}`]: "" }));
  };

  const updateRowValue = (ri: number, ci: number, val: string) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i === ri ? { ...r, values: r.values.map((v, j) => (j === ci ? val : v)) } : r
      )
    );

  // ---------- Validation ----------
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required.";
    if (selectedIds.length < 1)
      e.applicable = `At least one ${applicableLevel} is required.`;
    columns.forEach((col, i) => {
      if (!col.label.trim()) e[`col_label_${i}`] = "Label required.";
      if (!col.key.trim()) e[`col_key_${i}`] = "Key required.";
    });
    rows.forEach((row, i) => {
      if (!row.label.trim()) e[`row_label_${i}`] = "Label required.";
    });
    if (videoUrl && !/^https?:\/\/.+/.test(videoUrl))
      e.videoUrl = "Must be a valid http/https URL.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ---------- Mutation ----------
  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      axiosSecure.put(`/sizechart/update-sizechart/${slug}`, payload),
    onSuccess: () => {
      toast.success("Size chart updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["sizeCharts"] });
      queryClient.invalidateQueries({ queryKey: ["sizeChart", slug] });
      setTimeout(() => navigate("/sizechart-list"), 50);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update size chart");
    },
  });

  const handleSubmit = () => {
    if (!validate()) return;
    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      applicableLevel,
      applicableCategories: [],
      applicableSubCategories: [],
      applicableProducts: [],
      applicableVariants: [],
      applicableBrands: [],
      [LEVEL_KEY[applicableLevel]]: selectedIds,
      columns: columns.map((c, i) => ({ ...c, order: i })),
      rows: rows.map((r, i) => ({ ...r, order: i })),
      videoUrl: videoUrl.trim() || undefined,
    };
    mutation.mutate(payload);
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`Update Size Chart - ${name}`}
        description="Update size chart details"
      />
      <PageBreadcrumb pageTitle="Update Size Chart" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3">
                <Tooltip text="Go Back">
                  <Button
                    onClick={() => navigate(-1)}
                    aria-label="Go back"
                    size="sm"
                    variant="outline"
                    className="size-10 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-accent-500 transition-all flex items-center justify-center"
                  >
                    <FaArrowLeft className="size-4" />
                  </Button>
                </Tooltip>
                <h2 className="text-md font-medium text-gray-800 dark:text-white uppercase">
                  Update Size Chart
                </h2>
              </div>
              <Tooltip text="View Size Chart List">
                <Link to="/sizechart-list">
                  <Button
                    size="sm"
                      className="!bg-accent-500 hover:!bg-accent-600 !text-white px-4 py-2 rounded-lg font-bold"
                  >
                    Size Chart List
                  </Button>
                </Link>
              </Tooltip>
            </div>
          }
        >
          <div className="space-y-6">

            {/* ── Section 1: Basic Info ── */}
            <section className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-5">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label>Name <span className="text-red-500">*</span></Label>
                  <Input
                    type="text"
                    placeholder="e.g. Men's Shirt Size Guide"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((p) => ({ ...p, name: "" }));
                    }}
                    error={!!errors.name}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>Description</Label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description of this size chart"
                    rows={3}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white transition-all resize-none"
                  />
                </div>
                <div>
                  <Label>Video URL</Label>
                  <Input
                    type="text"
                    value={videoUrl}
                    placeholder="https://youtube.com/..."
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      if (!e.target.value || /^https?:\/\/.+/.test(e.target.value))
                        setErrors((p) => ({ ...p, videoUrl: "" }));
                    }}
                    error={!!errors.videoUrl}
                  />
                  {errors.videoUrl && (
                    <p className="text-red-500 text-xs mt-1">{errors.videoUrl}</p>
                  )}
                </div>
              </div>
            </section>

            {/* ── Section 2: Applicable Scope ── */}
            <section className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm">
              <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-5">
                Applicable Scope
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label>Applicable Level</Label>
                  <Select
                    options={LEVEL_OPTIONS}
                    value={applicableLevel}
                    onChange={(v) => {
                      setApplicableLevel(v as ApplicableLevel);
                      setSelectedIds([]);
                    }}
                    placeholder="Select level"
                  />
                </div>
                <div>
                  <Label>
                    {LEVEL_LABEL[applicableLevel]} <span className="text-red-500">*</span>
                  </Label>
                  <MultiSelect
                    options={applicableOptions}
                    selected={selectedIds}
                    onChange={(ids) => {
                      setSelectedIds(ids);
                      if (errors.applicable) setErrors((p) => ({ ...p, applicable: "" }));
                    }}
                    placeholder={
                      optionsLoading
                        ? "Loading..."
                        : `Select ${LEVEL_LABEL[applicableLevel]}...`
                    }
                    loading={optionsLoading}
                    error={errors.applicable}
                  />
                  {errors.applicable && (
                    <p className="text-red-500 text-xs mt-1">{errors.applicable}</p>
                  )}
                </div>
              </div>
            </section>

            {/* ── Section 3: Visual Size Chart Editor ── */}
            <section className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm">
              <div className="flex items-center gap-2 mb-1">
                <FaTable className="size-3.5 text-accent-500" />
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-widest">
                  Direct Visual Size Chart Editor
                </h3>
              </div>
              <p className="text-xs text-gray-400 mb-5">
                Edit attributes (columns) and sizes (rows) directly inside the table below.
              </p>

              {/* Action buttons */}
              <div className="flex gap-3 mb-5">
                <button
                  onClick={addColumn}
                  disabled={columns.length >= 10}
                  className="shine flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-all active:scale-95"
                >
                  <FaPlus className="size-3" /> ADD ATTRIBUTE (COLUMN)
                </button>
                <button
                  onClick={addRow}
                    className="flex items-center gap-2 px-4 py-2 shine bg-accent-50 hover:bg-accent-100 text-accent-600 dark:bg-accent-500/15 dark:text-accent-400 dark:hover:bg-accent-500/25 text-xs font-bold rounded-lg transition-all active:scale-95"
                >
                  <FaPlus className="size-3" /> ADD SIZE (ROW)
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 text-left w-28 shrink-0">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          SIZE LABEL
                        </span>
                      </th>

                      {columns.map((col, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 min-w-32 border-l border-gray-200 dark:border-gray-700 relative group"
                        >
                          <button
                            onClick={() => removeColumn(i)}
                            aria-label="Remove column"
                            disabled={columns.length <= 1}
                            className="absolute top-1.5 right-1.5 size-4 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20 text-red-500 opacity-0 group-hover:opacity-100 disabled:hidden transition-opacity"
                          >
                            <FaTimes className="size-2.5" />
                          </button>

                          <input
                            type="text"
                            value={col.label}
                            onChange={(e) => updateColumnLabel(i, e.target.value)}
                            placeholder="Column name"
                            className={`w-full text-center text-xs font-black uppercase tracking-wide bg-transparent border-b pb-0.5 outline-none placeholder:text-gray-300 dark:text-white transition-colors ${
                              errors[`col_label_${i}`]
                                ? "border-red-400 text-red-500"
                                : "border-transparent focus:border-accent-400 text-gray-700 dark:text-gray-200"
                            }`}
                          />

                          <select
                            value={col.unit}
                            onChange={(e) => updateColumnUnit(i, e.target.value)}
                            className="w-full text-center text-[10px] font-semibold text-gray-400 dark:text-gray-500 bg-transparent outline-none cursor-pointer mt-0.5 hover:text-accent-500 transition-colors"
                          >
                            {UNIT_OPTIONS.map((u) => (
                              <option key={u.value} value={u.value}>{u.label}</option>
                            ))}
                          </select>
                        </th>
                      ))}

                      <th className="px-4 py-3 border-l border-gray-200 dark:border-gray-700 w-16">
                        <span className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          ACTION
                        </span>
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className="border-b border-gray-100 dark:border-gray-800 last:border-none hover:bg-accent-50/30 dark:hover:bg-accent-500/5 transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={row.label}
                            onChange={(e) => updateRowLabel(ri, e.target.value)}
                            placeholder="S"
                            className={`w-full h-9 px-3 text-sm font-bold text-center rounded-lg border outline-none focus:ring-1 focus:ring-accent-500/20 transition-all bg-white dark:bg-gray-900 dark:text-white placeholder:text-gray-300 ${
                              errors[`row_label_${ri}`]
                                ? "border-red-400 focus:border-red-400"
                                : "border-gray-200 dark:border-gray-700 focus:border-accent-500"
                            }`}
                          />
                          {errors[`row_label_${ri}`] && (
                            <p className="text-red-500 text-[10px] mt-0.5 text-center">{errors[`row_label_${ri}`]}</p>
                          )}
                        </td>

                        {row.values.map((val, ci) => (
                          <td key={ci} className="px-3 py-2.5 border-l border-gray-100 dark:border-gray-800">
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => updateRowValue(ri, ci, e.target.value)}
                              placeholder="—"
                              className="w-full h-9 px-3 text-sm text-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white placeholder:text-gray-300 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500/20 transition-all"
                            />
                          </td>
                        ))}

                        <td className="px-3 py-2.5 border-l border-gray-100 dark:border-gray-800 text-center">
                          <button
                            onClick={() => removeRow(ri)}
                            aria-label="Remove size row"
                            disabled={rows.length <= 1}
                            className="size-8 flex items-center justify-center mx-auto rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-20 transition-colors"
                          >
                            <FaTrashAlt className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Live Preview ── */}
              <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                  <span className="relative flex size-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full size-2 bg-green-500" />
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                    Live Preview
                  </span>
                  {name && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate max-w-xs">
                        {name}
                      </span>
                    </>
                  )}
                </div>

                <div className="overflow-x-auto bg-white dark:bg-gray-900">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-800 dark:bg-gray-950">
                        <th className="px-5 py-3.5 text-left text-[11px] font-black uppercase tracking-widest text-white/70 whitespace-nowrap w-24">
                          SIZE
                        </th>
                        {columns.map((col, i) => (
                          <th key={i} className="px-5 py-3.5 text-center text-[11px] font-black uppercase tracking-widest text-white/70 whitespace-nowrap">
                            <span className="block">{col.label || `Column ${i + 1}`}</span>
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
                      {rows.map((row, ri) => (
                        <tr
                          key={ri}
                          className={`border-b border-gray-100 dark:border-gray-800 last:border-none transition-colors ${
                            ri % 2 === 0
                              ? "bg-white dark:bg-gray-900"
                              : "bg-gray-50/60 dark:bg-gray-800/30"
                          }`}
                        >
                          <td className="px-5 py-3 font-black text-sm text-gray-800 dark:text-white whitespace-nowrap">
                            {row.label || <span className="text-gray-300 font-normal">—</span>}
                          </td>
                          {row.values.map((val, ci) => (
                            <td key={ci} className="px-5 py-3 text-center text-sm text-gray-600 dark:text-gray-300">
                              {val || <span className="text-gray-300 dark:text-gray-600">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* ── Submit ── */}
            <MobileActionBar>
              <div className="flex justify-end pt-2 pb-4">
                <Button
                  onClick={handleSubmit}
                  disabled={mutation.isPending}
                    className="!bg-accent-500 hover:!bg-accent-600 !text-white px-10 py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center gap-3 shadow-lg border-none active:scale-95 transition-all"
                >
                  {mutation.isPending ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <FaSync className="size-4" />
                      Update Size Chart
                    </>
                  )}
                </Button>
              </div>
            </MobileActionBar>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default SizeChartUpdate;
