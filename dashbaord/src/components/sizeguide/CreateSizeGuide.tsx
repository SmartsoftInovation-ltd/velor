import { useState, useEffect } from "react";
import {
  FaPlus, FaTrashAlt, FaRuler, FaVideo, FaInfoCircle,
  FaChevronRight,
  FaSlidersH,
  FaTag,
  FaTshirt
} from "react-icons/fa";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import Select from "../form/Select";
import SearchableSelect from "../form/SearchableSelect";

// --- Interfaces matching Schema ---
interface ColumnSchema {
  key: string;
  label: string;
  unit: "inch" | "cm";
  order: number;
}

interface RowSchema {
  label: string;
  values: string[];
  order: number;
}

interface SizeGuideSchema {
  name: string;
  description: string;
  applicableLevel: "category" | "subCategory" | "product" | "variant" | "brand";
  applicableCategories: string[];
  applicableSubCategories: string[];
  applicableProducts: string[];
  applicableVariants: string[];
  applicableBrands: string[];
  columns: ColumnSchema[];
  rows: RowSchema[];
  measurementGuide: string;
  videoUrl: string;
  visibility: "public" | "private";
  isActive: boolean;
}

// --- Mock Lists for Searchable Dropdowns ---
const MOCK_CATEGORIES = [
  { value: "cat-1", label: "Men's Clothing" },
  { value: "cat-2", label: "Women's Clothing" },
  { value: "cat-3", label: "Footwear" },
  { value: "cat-4", label: "Activewear" }
];

const MOCK_SUBCATEGORIES = [
  { value: "sub-1", label: "T-Shirts & Polos" },
  { value: "sub-2", label: "Jeans & Denim" },
  { value: "sub-3", label: "Sneakers" },
  { value: "sub-4", label: "Jackets & Coats" }
];

const MOCK_PRODUCTS = [
  { value: "prod-1", label: "Premium Slim-Fit Cotton Tee" },
  { value: "prod-2", label: "Urban Cargo Joggers" },
  { value: "prod-3", label: "Breathable Knit Running Shoes" }
];

const MOCK_VARIANTS = [
  { value: "var-1", label: "Red / L" },
  { value: "var-2", label: "Black / XL" },
  { value: "var-3", label: "Navy Blue / M" }
];

const MOCK_BRANDS = [
  { value: "brand-1", label: "Apex Athletics" },
  { value: "brand-2", label: "Urban Threads" },
  { value: "brand-3", label: "Z-Forge Premium" }
];

// Helper Component for Form Section Layouts
const SectionCard = ({ icon, title, children, className = "" }: any) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm overflow-hidden ${className}`}>
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="flex items-center justify-center size-8 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500">{icon}</div>
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const CreateSizeGuide = () => {
  // --- Core State ---
  const [formData, setFormData] = useState<SizeGuideSchema>({
    name: "Men's T-Shirt Size Guide",
    description: "Standard chest/waist/length chart for men shirts",
    applicableLevel: "category",
    applicableCategories: ["cat-1"],
    applicableSubCategories: [],
    applicableProducts: [],
    applicableVariants: [],
    applicableBrands: [],
    columns: [
      { key: "chest", label: "Chest", unit: "inch", order: 0 },
      { key: "waist", label: "Waist", unit: "inch", order: 1 },
      { key: "length", label: "Length", unit: "inch", order: 2 }
    ],
    rows: [
      { label: "S", values: ["36", "30", "27"], order: 0 },
      { label: "M", values: ["38", "32", "28"], order: 1 },
      { label: "L", values: ["40", "34", "29"], order: 2 },
      { label: "XL", values: ["42", "36", "30"], order: 3 },
      { label: "XXL", values: ["44", "38", "31"], order: 4 }
    ],
    measurementGuide: "Measure your chest at the widest point. Keep tape slightly loose and horizontal.",
    videoUrl: "",
    visibility: "public",
    isActive: true
  });

  // --- SearchableSelect inputs helpers ---
  const [tempSelectorVal, setTempSelectorVal] = useState("");

  // --- Interactive Storefront Preview States ---
  const [previewUnit, setPreviewUnit] = useState<"inch" | "cm">("inch");
  const [userMeasurementChest, setUserMeasurementChest] = useState("");
  const [userMeasurementWaist, setUserMeasurementWaist] = useState("");
  const [recommendedSize, setRecommendedSize] = useState<string | null>(null);
  const [activeHighlightCol, setActiveHighlightCol] = useState<string | null>(null);

  // --- Dynamically calculate best matching storefront size ---
  useEffect(() => {
    const chestVal = parseFloat(userMeasurementChest);
    const waistVal = parseFloat(userMeasurementWaist);

    if (isNaN(chestVal) && isNaN(waistVal)) {
      setRecommendedSize(null);
      return;
    }

    // Convert user measurement to inches if user inputted in CM
    const targetChest = previewUnit === "cm" && !isNaN(chestVal) ? chestVal / 2.54 : chestVal;
    const targetWaist = previewUnit === "cm" && !isNaN(waistVal) ? waistVal / 2.54 : waistVal;

    let bestMatch: string | null = null;
    let minDifference = Infinity;

    // Find the row where the sizes fit closest (or slightly roomy)
    formData.rows.forEach((row) => {
      const chestColIndex = formData.columns.findIndex(c => c.key === "chest");
      const waistColIndex = formData.columns.findIndex(c => c.key === "waist");

      const rowChest = chestColIndex !== -1 ? parseFloat(row.values[chestColIndex]) : NaN;
      const rowWaist = waistColIndex !== -1 ? parseFloat(row.values[waistColIndex]) : NaN;

      let chestFits = true;
      let waistFits = true;
      let diff = 0;

      if (!isNaN(targetChest) && !isNaN(rowChest)) {
        chestFits = rowChest >= targetChest;
        diff += (rowChest - targetChest);
      }
      if (!isNaN(targetWaist) && !isNaN(rowWaist)) {
        waistFits = rowWaist >= targetWaist;
        diff += (rowWaist - targetWaist);
      }

      if (chestFits && waistFits && diff < minDifference) {
        minDifference = diff;
        bestMatch = row.label;
      }
    });

    setRecommendedSize(bestMatch);
  }, [userMeasurementChest, userMeasurementWaist, previewUnit, formData.rows, formData.columns]);

  // --- Columns Handlers ---
  const addColumn = () => {
    const colCount = formData.columns.length;
    const newColKey = `col_${colCount + 1}`;
    const newCol: ColumnSchema = {
      key: newColKey,
      label: `New Attribute`,
      unit: "inch",
      order: colCount
    };

    setFormData(prev => ({
      ...prev,
      columns: [...prev.columns, newCol],
      rows: prev.rows.map(row => ({
        ...row,
        values: [...row.values, ""]
      }))
    }));
  };

  const removeColumn = (index: number) => {
    if (formData.columns.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== index),
      rows: prev.rows.map(row => ({
        ...row,
        values: row.values.filter((_, i) => i !== index)
      }))
    }));
  };

  const updateColumn = (index: number, field: keyof ColumnSchema, value: any) => {
    setFormData(prev => ({
      ...prev,
      columns: prev.columns.map((col, i) => i === index ? { ...col, [field]: value } : col)
    }));
  };

  // --- Rows Handlers ---
  const addRow = () => {
    const rowCount = formData.rows.length;
    const newRow: RowSchema = {
      label: `Size`,
      values: Array(formData.columns.length).fill(""),
      order: rowCount
    };
    setFormData(prev => ({
      ...prev,
      rows: [...prev.rows, newRow]
    }));
  };

  const removeRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index)
    }));
  };

  const updateRowLabel = (index: number, label: string) => {
    setFormData(prev => ({
      ...prev,
      rows: prev.rows.map((row, i) => i === index ? { ...row, label } : row)
    }));
  };

  const updateRowValue = (rowIndex: number, colIndex: number, val: string) => {
    setFormData(prev => ({
      ...prev,
      rows: prev.rows.map((row, i) => {
        if (i !== rowIndex) return row;
        const newValues = [...row.values];
        newValues[colIndex] = val;
        return { ...row, values: newValues };
      })
    }));
  };

  // --- Target Assignment Tags Handlers ---
  const getMockOptions = () => {
    switch (formData.applicableLevel) {
      case "category": return MOCK_CATEGORIES;
      case "subCategory": return MOCK_SUBCATEGORIES;
      case "product": return MOCK_PRODUCTS;
      case "variant": return MOCK_VARIANTS;
      case "brand": return MOCK_BRANDS;
    }
  };

  const getTargetFieldKey = () => {
    switch (formData.applicableLevel) {
      case "category": return "applicableCategories";
      case "subCategory": return "applicableSubCategories";
      case "product": return "applicableProducts";
      case "variant": return "applicableVariants";
      case "brand": return "applicableBrands";
    }
  };

  const addAssignedTarget = (val: string) => {
    if (!val) return;
    const key = getTargetFieldKey();
    const current = formData[key] as string[];
    if (!current.includes(val)) {
      setFormData(prev => ({
        ...prev,
        [key]: [...current, val]
      }));
    }
    setTempSelectorVal("");
  };

  const removeAssignedTarget = (val: string) => {
    const key = getTargetFieldKey();
    const current = formData[key] as string[];
    setFormData(prev => ({
      ...prev,
      [key]: current.filter(item => item !== val)
    }));
  };

  // --- Convert value helper for preview (Imperial / Metric) ---
  const renderPreviewVal = (valStr: string) => {
    const numeric = parseFloat(valStr);
    if (isNaN(numeric)) return "-";
    if (previewUnit === "cm") {
      return (numeric * 2.54).toFixed(1); // Converts dynamically from Inch to CM
    }
    return numeric.toString();
  };

  return (
    <div className="space-y-6 pb-12 text-gray-800 dark:text-gray-200">
      
      {/* Title Header with Glowing Badges */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-gradient-to-r from-brand-600 to-indigo-600 dark:from-brand-900/60 dark:to-indigo-900/60 rounded-3xl shadow-xl shadow-brand-500/10 text-white relative overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_120%,rgba(120,119,198,0.2),transparent)] pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="bg-white/10 backdrop-blur-md text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-white/20">Aesthetic UI Demo</span>
            <span className="bg-emerald-500 text-white text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <span className="size-1.5 rounded-full bg-white animate-pulse" /> Live Schema Sync
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-none mt-2">Dynamic Size Guide Architect</h1>
          <p className="text-white/70 text-xs md:text-sm font-medium">Create cross-module sizing guides with auto-recommendations and mobile-first preview layouts.</p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <Button className="bg-white text-brand-600 hover:bg-white/95 px-6 py-3.5 rounded-2xl font-black uppercase text-xs tracking-wider shadow-xl transition-all hover:-translate-y-0.5 active:translate-y-0">
            Export JSON Schema
          </Button>
        </div>
      </div>

      {/* Dual Pane Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        
        {/* ================= LEFT PANE: DYNAMIC ARCHITECT BUILDER (col-span-7) ================= */}
        <div className="xl:col-span-7 space-y-6">
          
          {/* Card 1: Core Details */}
          <SectionCard icon={<FaSlidersH />} title="Architect details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Label>Size Guide Name</Label>
                <Input 
                  name="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} 
                  placeholder="e.g. Men's T-Shirt Standard Chart" 
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Input 
                  name="description" 
                  value={formData.description} 
                  onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} 
                  placeholder="Sizing specs and chest/waist measurements for shirts" 
                />
              </div>
              <div>
                <Label>Visibility State</Label>
                <Select 
                  options={[{ value: "public", label: "Public (Storefront Visible)" }, { value: "private", label: "Private (Hidden)" }]} 
                  value={formData.visibility} 
                  onChange={(v) => setFormData(p => ({ ...p, visibility: v as any }))} 
                />
              </div>
              <div>
                <Label>Active Status</Label>
                <Select 
                  options={[{ value: "true", label: "Active" }, { value: "false", label: "Deactive" }]} 
                  value={formData.isActive.toString()} 
                  onChange={(v) => setFormData(p => ({ ...p, isActive: v === "true" }))} 
                />
              </div>
            </div>
          </SectionCard>

          {/* Card 2: Assignment / Applicable Levels */}
          <SectionCard icon={<FaTag />} title="Target module assignments">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                <div>
                  <Label>Applicable Sizing Level</Label>
                  <Select 
                    options={[
                      { value: "category", label: "Category Level" },
                      { value: "subCategory", label: "Sub-Category Level" },
                      { value: "product", label: "Product Level" },
                      { value: "variant", label: "Variant Level" },
                      { value: "brand", label: "Brand Level" }
                    ]} 
                    value={formData.applicableLevel} 
                    onChange={(v) => {
                      setFormData(p => ({ 
                        ...p, 
                        applicableLevel: v as any,
                        applicableCategories: [],
                        applicableSubCategories: [],
                        applicableProducts: [],
                        applicableVariants: [],
                        applicableBrands: []
                      }));
                      setTempSelectorVal("");
                    }} 
                  />
                </div>
                <div>
                  <Label>Assign Targets</Label>
                  <SearchableSelect 
                    options={getMockOptions()} 
                    value={tempSelectorVal} 
                    onChange={addAssignedTarget} 
                    placeholder={`Select ${formData.applicableLevel}...`}
                  />
                </div>
              </div>

              {/* Display tags */}
              <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/20">
                <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">
                  Currently Assigned Targets
                </h4>
                <div className="flex flex-wrap gap-2">
                  {(formData[getTargetFieldKey()] as string[]).length === 0 ? (
                    <span className="text-xs text-gray-400 italic">No targets assigned. This guide will be unassigned.</span>
                  ) : (
                    (formData[getTargetFieldKey()] as string[]).map((val) => {
                      const opt = getMockOptions().find(o => o.value === val);
                      return (
                        <span 
                          key={val} 
                          className="pl-3 pr-2 py-1.5 rounded-lg border border-brand-100 bg-brand-50 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400 text-xs font-bold flex items-center gap-2 group hover:border-red-200 hover:bg-red-50 hover:text-red-700 dark:hover:border-red-500/20 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors cursor-pointer"
                          onClick={() => removeAssignedTarget(val)}
                        >
                          {opt ? opt.label : val}
                          <FaTrashAlt className="size-2.5 text-brand-400 group-hover:text-red-500 transition-colors" />
                        </span>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Card 3: Size Chart Grid Builder */}
          <SectionCard icon={<FaRuler />} title="Direct Visual Size Chart Editor">
            <div className="space-y-6">
              
              {/* Header actions */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                  Edit attributes (columns) and sizes (rows) <strong>directly inside the table below</strong>! Measurements should be entered in <strong>Inches</strong> for smart dynamic conversion on storefront.
                </span>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={addColumn} 
                      className="h-9 px-4 rounded-xl bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] font-bold text-xs uppercase flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <FaPlus className="size-2.5" /> Add Attribute (Column)
                  </button>
                  <button 
                    type="button" 
                    onClick={addRow} 
                      className="h-9 px-4 rounded-xl bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] font-bold text-xs uppercase flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                  >
                    <FaPlus className="size-2.5" /> Add Size (Row)
                  </button>
                </div>
              </div>

              {/* Sizing Grid inputs - Visual Spreadsheet */}
              <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                      <th className="px-4 py-4 text-xs font-black uppercase text-gray-400 tracking-wider w-24">Size Label</th>
                      {formData.columns.map((col, idx) => (
                        <th 
                          key={col.key} 
                          className="px-4 py-4 text-xs font-black uppercase tracking-wider relative group border-l border-gray-100/50 dark:border-gray-800/50"
                          onMouseEnter={() => setActiveHighlightCol(col.key)}
                          onMouseLeave={() => setActiveHighlightCol(null)}
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between gap-1.5">
                              {/* Direct Label Rename input */}
                              <input 
                                type="text" 
                                value={col.label} 
                                onChange={(e) => updateColumn(idx, "label", e.target.value)}
                                className="bg-transparent font-black uppercase text-xs tracking-wider text-gray-700 dark:text-gray-200 outline-none border-b border-transparent focus:border-brand-500 py-0.5 w-full focus:bg-white dark:focus:bg-gray-900 px-1 rounded transition-colors"
                                placeholder="Attribute"
                                title="Click to rename attribute"
                              />
                              
                              {/* Column Delete Button */}
                              <button 
                                type="button" 
                                onClick={() => removeColumn(idx)}
                                disabled={formData.columns.length <= 1}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-0.5 rounded disabled:opacity-0 disabled:pointer-events-none"
                                title="Delete Attribute Column"
                              >
                                <FaTrashAlt className="size-2.5" />
                              </button>
                            </div>
                            
                            {/* Unit selector directly in the header cell */}
                            <select 
                              value={col.unit}
                              onChange={(e) => updateColumn(idx, "unit", e.target.value as any)}
                              className="text-[9px] font-black tracking-widest uppercase text-brand-500 dark:text-brand-400 bg-transparent outline-none cursor-pointer border border-transparent hover:border-brand-300 dark:hover:border-brand-500/30 rounded px-1 py-0.5 transition-all w-16"
                            >
                              <option value="inch">Inch</option>
                              <option value="cm">CM</option>
                            </select>
                          </div>
                        </th>
                      ))}
                      <th className="px-4 py-4 text-xs font-black uppercase text-gray-400 tracking-wider w-16 text-center border-l border-gray-100/50 dark:border-gray-800/50">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                    {formData.rows.map((row, rIdx) => (
                      <tr 
                        key={rIdx} 
                        className={`transition-colors ${recommendedSize === row.label ? "bg-brand-500/5 dark:bg-brand-500/5" : "hover:bg-gray-50/30 dark:hover:bg-gray-800/10"}`}
                      >
                        <td className="px-4 py-3">
                          <input 
                            type="text" 
                            value={row.label} 
                            onChange={(e) => updateRowLabel(rIdx, e.target.value)} 
                            className="w-full h-9 px-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-center outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 text-gray-700 dark:text-white"
                            placeholder="e.g. S"
                          />
                        </td>
                        {formData.columns.map((col, cIdx) => (
                          <td 
                            key={col.key} 
                            className="px-4 py-3 border-l border-gray-100/50 dark:border-gray-800/50"
                          >
                            <input 
                              type="number" 
                              value={row.values[cIdx] || ""} 
                              onChange={(e) => updateRowValue(rIdx, cIdx, e.target.value)}
                              placeholder="0.0"
                              step="0.1"
                              className="w-full h-9 px-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-xs font-semibold outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 text-gray-700 dark:text-white"
                              onFocus={() => setActiveHighlightCol(col.key)}
                              onBlur={() => setActiveHighlightCol(null)}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center border-l border-gray-100/50 dark:border-gray-800/50">
                          <button 
                            type="button" 
                            onClick={() => removeRow(rIdx)}
                            className="p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 dark:text-gray-700 dark:hover:text-red-500 dark:hover:bg-red-500/10 transition-colors"
                            title="Delete Size Row"
                          >
                            <FaTrashAlt className="size-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Live Visual Spec Blueprint Card */}
              <div className="p-5 rounded-2xl border border-dashed border-brand-200 dark:border-brand-500/20 bg-brand-50/20 dark:bg-brand-500/5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500"></span>
                  </span>
                  <h4 className="text-xs font-black text-brand-600 dark:text-brand-400 uppercase tracking-widest flex items-center gap-1.5">
                    👕 Real-Time Visual Garment Spec Blueprint
                  </h4>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
                  These sizing cards visualize exactly how each size configuration maps in real-time. They adapt automatically as you change column labels or update measurement numbers above!
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                  {formData.rows.map((row, rIdx) => (
                    <div 
                      key={rIdx} 
                      className="p-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden group hover:border-brand-400 dark:hover:border-brand-500/30 transition-all duration-300"
                    >
                      {/* Ribbon Tag */}
                      <div className="absolute top-0 right-0 bg-brand-500 text-white text-[8px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-bl-xl shadow-sm">
                        spec
                      </div>
                      
                      {/* Size Label */}
                      <div className="text-xs font-black text-gray-800 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2 mb-3 flex items-center gap-2">
                        <span className="size-5 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500 flex items-center justify-center text-[10px] font-black">
                          {row.label || "?"}
                        </span>
                        Size {row.label || "Unnamed"}
                      </div>

                      {/* Attribute mapping */}
                      <div className="space-y-2">
                        {formData.columns.map((col, cIdx) => (
                          <div key={col.key} className="flex justify-between items-center text-[10px] bg-gray-50/50 dark:bg-gray-800/30 p-1.5 rounded-lg border border-gray-100/30 dark:border-gray-800/30">
                            <span className="text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">{col.label}:</span>
                            <span className="font-black text-gray-700 dark:text-gray-200">
                              {row.values[cIdx] ? `${row.values[cIdx]} ${col.unit}` : "—"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </SectionCard>

          {/* Card 4: Measurement and Video Guide */}
          <SectionCard icon={<FaVideo />} title="Measurement tips & video guide">
            <div className="space-y-4">
              <div>
                <Label>Storefront Sizing Tip / Measurement Guide</Label>
                <textarea 
                  value={formData.measurementGuide} 
                  onChange={(e) => setFormData(p => ({ ...p, measurementGuide: e.target.value }))}
                  className="w-full h-24 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs outline-none focus:ring-2 focus:ring-brand-500/10 text-gray-700 dark:text-gray-200 resize-none placeholder:text-gray-400"
                  placeholder="Explain how users should measure chest/waist..."
                />
              </div>
              <div>
                <Label>Video Guide URL (Optional)</Label>
                <Input 
                  name="videoUrl" 
                  value={formData.videoUrl} 
                  onChange={(e) => setFormData(p => ({ ...p, videoUrl: e.target.value }))}
                  placeholder="e.g. https://www.youtube.com/watch?v=..." 
                />
              </div>
            </div>
          </SectionCard>

        </div>

        {/* ================= RIGHT PANE: PREMIUM CUSTOMER-FACING STOREFRONT PREVIEW (col-span-5) ================= */}
        <div className="xl:col-span-5 lg:sticky lg:top-6 space-y-6">
          
          <div className="bg-gradient-to-b from-gray-900 to-indigo-950 text-white rounded-3xl p-6 shadow-2xl relative border border-white/5 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* Preview Banner Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <FaTshirt className="text-brand-400 text-lg animate-bounce" />
                <span className="text-[10px] font-black tracking-widest uppercase text-brand-400">Live Customer Sizing Modal</span>
              </div>
              <span className="text-[10px] bg-white/5 border border-white/15 px-2.5 py-1 rounded-full text-white/50 font-bold flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" /> Dynamic Preview
              </span>
            </div>

            {/* Product description header */}
            <div className="space-y-1.5 mb-6">
              <h2 className="text-xl font-black tracking-tight">{formData.name || "Untitled Size Guide"}</h2>
              <p className="text-white/60 text-xs font-semibold leading-relaxed">{formData.description || "No description provided."}</p>
            </div>

            {/* Dynamic Sizing Interactive Calculator Card */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-4 mb-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-brand-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-bl-lg">
                Interactive Assistant
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-brand-400 tracking-wider">Find Your Recommended Size</h3>
                
                {/* Dynamic unit switcher */}
                <div className="flex items-center bg-white/5 p-1 rounded-lg border border-white/10">
                  <button 
                    type="button"
                    onClick={() => setPreviewUnit("inch")} 
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${previewUnit === "inch" ? "bg-brand-500 text-white shadow-lg" : "text-white/40 hover:text-white"}`}
                  >
                    IN
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPreviewUnit("cm")} 
                    className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all ${previewUnit === "cm" ? "bg-brand-500 text-white shadow-lg" : "text-white/40 hover:text-white"}`}
                  >
                    CM
                  </button>
                </div>
              </div>

              {/* User measurement input fields */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-white/50 tracking-widest block mb-1">Your Chest Size ({previewUnit === "inch" ? "Inches" : "CM"})</label>
                  <input 
                    type="number" 
                    value={userMeasurementChest} 
                    onChange={(e) => setUserMeasurementChest(e.target.value)} 
                    placeholder={previewUnit === "inch" ? "e.g. 38" : "e.g. 96"}
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-brand-400 text-xs text-white font-bold transition-all placeholder:text-white/20"
                    onFocus={() => setActiveHighlightCol("chest")}
                    onBlur={() => setActiveHighlightCol(null)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-white/50 tracking-widest block mb-1">Your Waist Size ({previewUnit === "inch" ? "Inches" : "CM"})</label>
                  <input 
                    type="number" 
                    value={userMeasurementWaist} 
                    onChange={(e) => setUserMeasurementWaist(e.target.value)} 
                    placeholder={previewUnit === "inch" ? "e.g. 32" : "e.g. 81"}
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 outline-none focus:border-brand-400 text-xs text-white font-bold transition-all placeholder:text-white/20"
                    onFocus={() => setActiveHighlightCol("waist")}
                    onBlur={() => setActiveHighlightCol(null)}
                  />
                </div>
              </div>

              {/* Recommended size readout with glowing gradient */}
              {recommendedSize ? (
                <div className="p-3 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                    <div>
                      <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Recommended Fit</h4>
                      <p className="text-white/70 text-[10px] font-medium mt-0.5">Based on your measurements</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 rounded-lg font-black text-sm tracking-widest shadow-lg shadow-emerald-500/25">
                    SIZE: {recommendedSize}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-center">
                  <p className="text-white/40 text-[10px] font-semibold italic">Enter your measurements above to reveal your perfect best-fit size recommended row.</p>
                </div>
              )}
            </div>

            {/* Custom Interactive Vector Illustration for Chest/Waist Highlights */}
            <div className="mb-6 bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-around gap-4 relative">
              
              {/* Custom SVG Figure illustration */}
              <svg className="w-24 h-40 text-white/10 dark:text-white/5" viewBox="0 0 100 200" fill="currentColor">
                {/* Head */}
                <circle cx="50" cy="20" r="12" className="text-white/30" />
                {/* Neck */}
                <rect x="47" y="32" width="6" height="8" rx="2" className="text-white/30" />
                {/* Body & Shoulders */}
                <path d="M30 40 H70 L75 80 L68 180 H32 L25 80 Z" className="text-white/20" />
                {/* Chest Guide Path Highlight */}
                <path 
                  d="M27 65 H73" 
                  stroke={activeHighlightCol === "chest" ? "#3b82f6" : "rgba(255,255,255,0.2)"} 
                  strokeWidth="3.5" 
                  strokeDasharray="4 2" 
                  className="transition-all duration-300"
                />
                {/* Waist Guide Path Highlight */}
                <path 
                  d="M29 95 H71" 
                  stroke={activeHighlightCol === "waist" ? "#3b82f6" : "rgba(255,255,255,0.2)"} 
                  strokeWidth="3.5" 
                  strokeDasharray="4 2" 
                  className="transition-all duration-300"
                />
              </svg>

              <div className="flex-1 space-y-3">
                <h4 className="text-[10px] font-black text-brand-400 uppercase tracking-widest">Visual Measuring Guide</h4>
                <div className="space-y-2">
                  <div className={`flex items-start gap-2.5 p-2 rounded-xl transition-all ${activeHighlightCol === "chest" ? "bg-brand-500/10 border border-brand-500/20" : "border border-transparent"}`}>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${activeHighlightCol === "chest" ? "bg-brand-500 text-white" : "bg-white/10 text-white/50"}`}>1</span>
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-wider">Chest Measurement</h5>
                      <p className="text-[9px] text-white/50 mt-0.5 leading-tight">Measure around body at fullest chest point, keeping tape flat.</p>
                    </div>
                  </div>
                  <div className={`flex items-start gap-2.5 p-2 rounded-xl transition-all ${activeHighlightCol === "waist" ? "bg-brand-500/10 border border-brand-500/20" : "border border-transparent"}`}>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${activeHighlightCol === "waist" ? "bg-brand-500 text-white" : "bg-white/10 text-white/50"}`}>2</span>
                    <div>
                      <h5 className="text-[10px] font-black uppercase tracking-wider">Waist Measurement</h5>
                      <p className="text-[9px] text-white/50 mt-0.5 leading-tight">Measure around natural waistline, keeping tape comfortable.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer view of Size Table */}
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-white/40 tracking-wider">Size</th>
                    {formData.columns.map((col) => (
                      <th 
                        key={col.key} 
                        className={`px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors ${activeHighlightCol === col.key ? "text-brand-400" : "text-white/40"}`}
                      >
                        {col.label} ({previewUnit})
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {formData.rows.map((row) => {
                    const isRecommended = recommendedSize === row.label;
                    return (
                      <tr 
                        key={row.label} 
                        className={`transition-all duration-300 ${isRecommended ? "bg-brand-500/20 font-bold border-l-4 border-brand-500 scale-[1.01]" : "hover:bg-white/5"}`}
                      >
                        <td className="px-4 py-3.5 text-xs tracking-wider flex items-center gap-2">
                          {row.label}
                          {isRecommended && (
                            <span className="text-[8px] bg-brand-500 text-white font-black px-1 rounded-sm animate-pulse tracking-wide">FIT</span>
                          )}
                        </td>
                        {formData.columns.map((col, cIdx) => (
                          <td 
                            key={col.key} 
                            className={`px-4 py-3.5 text-xs transition-colors ${activeHighlightCol === col.key ? "text-brand-400 font-bold" : "text-white/80"}`}
                          >
                            {renderPreviewVal(row.values[cIdx])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sizing description guide */}
            {formData.measurementGuide && (
              <div className="mt-5 p-4 rounded-2xl border border-white/5 bg-white/5 flex gap-3">
                <FaInfoCircle className="text-brand-400 size-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase text-brand-400 tracking-wider">Measurement Instructions</h4>
                  <p className="text-[11px] text-white/60 leading-relaxed font-semibold">{formData.measurementGuide}</p>
                </div>
              </div>
            )}

            {/* Video embed widget */}
            {formData.videoUrl && (
              <a 
                href={formData.videoUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="mt-4 p-4 rounded-2xl border border-white/10 hover:border-brand-500/50 bg-gradient-to-r from-red-950/20 to-indigo-950/20 hover:from-red-950/30 hover:to-indigo-950/30 transition-all flex items-center justify-between group cursor-pointer shadow-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-red-600/10 group-hover:bg-red-600/20 flex items-center justify-center text-red-500 transition-colors">
                    <FaVideo className="text-lg animate-pulse" />
                  </div>
                  <div>
                    <h5 className="text-[11px] font-black text-white group-hover:text-brand-400 transition-colors uppercase tracking-wider">How to Measure Video Guide</h5>
                    <p className="text-[9px] text-white/40 mt-0.5">Watch our quick 1-minute sizing tutorial</p>
                  </div>
                </div>
                <FaChevronRight className="text-white/20 group-hover:text-brand-400 group-hover:translate-x-1 transition-all" />
              </a>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

export default CreateSizeGuide;
