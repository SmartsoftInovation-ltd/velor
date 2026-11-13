import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FaBullseye, FaInfoCircle, FaTable } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";
import { LEVELS, LEVEL_KEY, type ApplicableLevel, type Column, type IdOption, type Row } from "./sizeChartConfig";
import { LevelPicker, MultiSelect, SectionCard, StepHeader } from "./sizeChartParts";
import SizeChartTableEditor from "./SizeChartTableEditor";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "create-sizechart";

// A first measurement and size to fill in; the row label is the size itself
const startColumns = (): Column[] => [{ key: "chest", label: "Chest", unit: "inch", order: 0 }];
const startRows = (): Row[] => [{ label: "S", values: [""], order: 0 }];

const CreateSizeChartForm = () => {
  const queryClient = useQueryClient();

  const [name, setName] = useState(() => draftValue(DRAFT_KEY, "name", ""));
  const [description, setDescription] = useState(() => draftValue(DRAFT_KEY, "description", ""));
  const [applicableLevel, setApplicableLevel] = useState<ApplicableLevel>(() => draftValue<ApplicableLevel>(DRAFT_KEY, "applicableLevel", "category"));
  const [selectedIds, setSelectedIds] = useState<string[]>(() => draftValue<string[]>(DRAFT_KEY, "selectedIds", []));
  const [applicableOptions, setApplicableOptions] = useState<IdOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [columns, setColumns] = useState<Column[]>(() => draftValue<Column[]>(DRAFT_KEY, "columns", startColumns()));
  const [rows, setRows] = useState<Row[]>(() => draftValue<Row[]>(DRAFT_KEY, "rows", startRows()));
  const [videoUrl, setVideoUrl] = useState(() => draftValue(DRAFT_KEY, "videoUrl", ""));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ name, description, applicableLevel, selectedIds, columns, rows, videoUrl }), [name, description, applicableLevel, selectedIds, columns, rows, videoUrl]),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) => setErrors((p) => (p[key] ? { ...p, [key]: "" } : p));

  const level = LEVELS.find((l) => l.value === applicableLevel) ?? LEVELS[0];

  // ---------- Fetch applicable options ----------
  useEffect(() => {
    const load = async () => {
      setOptionsLoading(true);
      setApplicableOptions([]);
      try {
        if (applicableLevel === "category") {
          const { data } = await axiosSecure.get("/categories");
          setApplicableOptions((data.data.categories || []).map((c: { _id: string; name: string }) => ({ value: c._id, label: c.name })));
        } else if (applicableLevel === "subCategory") {
          const { data } = await axiosSecure.get("/categories");
          const cats: { name: string; subcategories?: { _id: string; name: string }[] }[] = data.data.categories || [];
          setApplicableOptions(cats.flatMap((c) => (c.subcategories || []).map((s) => ({ value: s._id, label: `${s.name} (${c.name})` }))));
        } else if (applicableLevel === "brand") {
          const { data } = await axiosSecure.get("/brand");
          setApplicableOptions((data.data.brands || []).map((b: { _id: string; name: string }) => ({ value: b._id, label: b.name })));
        } else if (applicableLevel === "product") {
          const res = await axiosSecure.get("/product/getproduct");
          const all: { _id: string; name: string; variantType?: string }[] = res.data?.data?.products || res.data?.data || [];
          setApplicableOptions(all.filter((p) => p.variantType === "singleVariant").map((p) => ({ value: p._id, label: p.name })));
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

  // ---------- Validation ----------
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Give the chart a name.";
    if (selectedIds.length < 1) e.applicable = `Pick at least one ${level.label.toLowerCase()}.`;
    columns.forEach((col, i) => {
      if (!col.label.trim()) e[`col_label_${i}`] = "Name this measurement";
    });
    rows.forEach((row, i) => {
      if (!row.label.trim()) e[`row_label_${i}`] = "Enter a size";
    });
    if (videoUrl && !/^https?:\/\/.+/.test(videoUrl)) e.videoUrl = "Use a full link starting with https://";
    setErrors(e);
    const count = Object.values(e).filter(Boolean).length;
    if (count) toast.error(count === 1 ? Object.values(e)[0] : `${count} fields need attention`);
    return count === 0;
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      applicableLevel,
      applicableCategories: [],
      applicableSubCategories: [],
      applicableProducts: [],
      applicableVariants: [],
      applicableBrands: [],
      [LEVEL_KEY[applicableLevel]]: selectedIds,
      columns: columns.map((c, i) => ({ ...c, label: c.label.trim(), order: i })),
      rows: rows.map((r, i) => ({ ...r, label: r.label.trim(), order: i })),
      videoUrl: videoUrl.trim() || undefined,
    };
    try {
      await axiosSecure.post("/sizechart/create-sizechart", payload);
      toast.success("Size chart created successfully!");
      clearDraft(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["sizeCharts"] });
      setName(""); setDescription(""); setApplicableLevel("category");
      setSelectedIds([]);
      setColumns(startColumns());
      setRows(startRows());
      setVideoUrl(""); setErrors({});
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || "Failed to create size chart");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Step 1: Name ── */}
      <SectionCard>
        <StepHeader step={1} icon={FaInfoCircle} title="Name the chart" hint="Shoppers see this name as the title of the size chart." />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <Label htmlFor="sc-name">Chart name <span className="text-error-500">*</span></Label>
            <Input
              id="sc-name"
              placeholder="e.g. Men's Panjabi Size Chart"
              value={name}
              onChange={(e) => { setName(e.target.value); clearError("name"); }}
              error={!!errors.name}
            />
            {errors.name && <p className="mt-1 text-xs text-error-500">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="sc-video">How-to-measure video <span className="font-normal text-gray-400">(optional)</span></Label>
            <Input
              id="sc-video"
              placeholder="https://youtube.com/..."
              value={videoUrl}
              onChange={(e) => { setVideoUrl(e.target.value); clearError("videoUrl"); }}
              error={!!errors.videoUrl}
            />
            {errors.videoUrl && <p className="mt-1 text-xs text-error-500">{errors.videoUrl}</p>}
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="sc-desc">Note for shoppers <span className="font-normal text-gray-400">(optional)</span></Label>
            <textarea
              id="sc-desc"
              placeholder="e.g. Measurements are of the body, not the garment. Between two sizes? Pick the larger one."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm shadow-theme-xs transition-all placeholder:text-gray-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      </SectionCard>

      {/* ── Step 2: Where it applies ── */}
      <SectionCard>
        <StepHeader step={2} icon={FaBullseye} title="Choose where it shows" hint="Pick a level, then the items. The most specific chart wins: variant, product, sub category, category, brand." />
        <LevelPicker value={applicableLevel} onChange={(v) => { setApplicableLevel(v); setSelectedIds([]); clearError("applicable"); }} />
        <div className="mt-5">
          <Label>{level.plural} <span className="text-error-500">*</span></Label>
          <MultiSelect
            options={applicableOptions}
            selected={selectedIds}
            onChange={(ids) => { setSelectedIds(ids); clearError("applicable"); }}
            placeholder={`Search and pick ${level.plural.toLowerCase()}...`}
            loading={optionsLoading}
            error={errors.applicable}
            icon={level.icon}
          />
          {errors.applicable && <p className="mt-1 text-xs text-error-500">{errors.applicable}</p>}
        </div>
      </SectionCard>

      {/* ── Step 3: Table ── */}
      <SectionCard>
        <StepHeader step={3} icon={FaTable} title="Fill in the measurements" hint="Each column is a measurement (Chest, Length…) with its unit. Each row is a size. Use the quick buttons to start fast." />
        <SizeChartTableEditor
          columns={columns}
          rows={rows}
          setColumns={setColumns}
          setRows={setRows}
          errors={errors}
          clearError={clearError}
          chartName={name}
        />
      </SectionCard>

      {/* ── Submit ── */}
      <MobileActionBar>
        <div className="flex justify-end pb-4 pt-1">
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="!bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 !rounded-xl font-semibold text-sm flex items-center gap-2.5 shadow-lg border-none active:scale-95 transition-all"
          >
            {isLoading ? (
              <>
                <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Creating...</span>
              </>
            ) : (
              "Create Size Chart"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
};

export default CreateSizeChartForm;
