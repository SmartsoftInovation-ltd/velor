import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import DatePicker from "../form/date-picker";
import Label from "../form/Label";
import SearchableSelect from "../form/SearchableSelect";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import SectionCard from "../common/SectionCard";
import { FaTags, FaCalendarAlt, FaImage } from "react-icons/fa";
import { TrashBinIcon } from "../../icons";
import { showApiError } from "../../utils/apiError";
import { scopedStorageKey } from "../../lib/session";

const Req = () => <span className="text-red-500 ml-0.5">*</span>;

const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p className="text-red-500 text-xs mt-1 font-medium">{msg}</p> : null;

const DRAFT_STORAGE_KEY = "createDiscountFormDraft";

interface DiscountFormData {
  discountName: string;
  discountPlan: string;
  discountType: string;
  discountValidFrom: string;
  discountValidTo: string;
  discountValueByAmount: string;
  discountValueByPercentance: string;
}

interface DiscountFormDraft {
  formData: Partial<DiscountFormData>;
  selectedType: string;
  selectedItemId: string;
}

const emptyFormData: DiscountFormData = {
  discountName: "",
  discountPlan: "",
  discountType: "",
  discountValidFrom: "",
  discountValidTo: "",
  discountValueByAmount: "",
  discountValueByPercentance: "",
};

const loadDraft = (): DiscountFormDraft | null => {
  try {
    const raw = sessionStorage.getItem(scopedStorageKey(DRAFT_STORAGE_KEY));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const CreateDiscountForm = () => {
  const draft = loadDraft();
  const isFirstRender = useRef(true);

  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(draft?.selectedType || "");
  const [selectedItemId, setSelectedItemId] = useState(
    draft?.selectedItemId || "",
  );

  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [variantProducts, setVariantProducts] = useState<any[]>([]);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<DiscountFormData>({
    ...emptyFormData,
    ...(draft?.formData || {}),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Persist form data (except the image, which can't survive a reload) so a
  // refresh doesn't wipe out an in-progress draft.
  useEffect(() => {
    sessionStorage.setItem(
      scopedStorageKey(DRAFT_STORAGE_KEY),
      JSON.stringify({ formData, selectedType, selectedItemId }),
    );
  }, [formData, selectedType, selectedItemId]);

  // Re-fetch the dependent dropdown options once on mount if a plan was
  // restored from the draft, so the SearchableSelect can show its label.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (draft?.formData?.discountPlan) {
        fetchPlanOptions(draft.formData.discountPlan);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeOptions = [
    { value: "tk", label: "Tk (Fixed Amount)" },
    { value: "percentance", label: "Percentage (%)" },
  ];

  const planOptions = [
    { value: "flat", label: "Flat" },
    { value: "category", label: "Category" },
    { value: "subCategory", label: "SubCategory" },
    { value: "product", label: "Product" },
    { value: "variant", label: "Variant" },
  ];

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setFormData((prev) => ({ ...prev, discountType: value }));
    if (value) setErrors((prev) => ({ ...prev, discountType: "" }));
  };

  const fetchPlanOptions = async (value: string) => {
    try {
      if (value === "category") {
        const res = await axiosSecure.get("/categories");
        setCategories(res.data.data.categories || []);
      } else if (value === "subCategory") {
        const res = await axiosSecure.get("/subcategories");
        setSubCategories(res.data.data.subCategories || res.data.data || []);
      } else if (value === "product") {
        const res = await axiosSecure.get("/product/getproduct");
        const all = res.data?.data?.products || res.data?.data || [];
        setProducts(
          (Array.isArray(all) ? all : []).filter(
            (p: any) => p.variantType === "singleVariant",
          ),
        );
      } else if (value === "variant") {
        const res = await axiosSecure.get("/product/multiplevarinatproduct");
        setVariantProducts(res.data.data?.products || []);
      }
    } catch {
      // options simply stay empty
    }
  };

  const handlePlanChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, discountPlan: value }));
    setSelectedItemId("");
    if (value) setErrors((prev) => ({ ...prev, discountPlan: "" }));
    await fetchPlanOptions(value);
  };

  const handleDateChange = (
    field: "discountValidFrom" | "discountValidTo",
    date: string,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: date }));
    if (date) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (value.trim()) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  // ---------- Dropzone ----------
  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length > 0) {
      const code = rejected[0].errors[0].code;
      if (code === "file-too-large") toast.error("Max file size is 5MB.");
      else if (code === "file-invalid-type") toast.error("Images only.");
      else toast.error(rejected[0].errors[0].message);
      return;
    }
    if (accepted[0]) {
      setImage(accepted[0]);
      setPreview(URL.createObjectURL(accepted[0]));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".png", ".jpg", ".webp", ".svg"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    setPreview(null);
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.discountName)
      newErrors.discountName = "Discount name is required.";
    if (!formData.discountPlan)
      newErrors.discountPlan = "Discount plan is required.";
    if (formData.discountPlan !== "flat" && !selectedItemId)
      newErrors.selectedItemId = "Please select an item.";
    if (!formData.discountType)
      newErrors.discountType = "Discount type is required.";
    if (!formData.discountValidFrom)
      newErrors.discountValidFrom = "Start date is required.";
    if (!formData.discountValidTo)
      newErrors.discountValidTo = "End date is required.";
    if (formData.discountType === "tk" && !formData.discountValueByAmount)
      newErrors.discountValueByAmount = "Amount is required.";
    if (
      formData.discountType === "percentance" &&
      !formData.discountValueByPercentance
    )
      newErrors.discountValueByPercentance = "Percentage is required.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);
    try {
      const payload: any = {
        discountName: formData.discountName,
        discountPlan: formData.discountPlan,
        discountType: formData.discountType,
        discountValidFrom: formData.discountValidFrom,
        discountValidTo: formData.discountValidTo,
      };

      if (formData.discountType === "tk")
        payload.discountValueByAmount = Number(formData.discountValueByAmount);
      else if (formData.discountType === "percentance")
        payload.discountValueByPercentance = Number(
          formData.discountValueByPercentance,
        );

      if (formData.discountPlan === "category")
        payload.category = selectedItemId;
      else if (formData.discountPlan === "subCategory")
        payload.subCategory = selectedItemId;
      else if (formData.discountPlan === "product")
        payload.product = selectedItemId;
      else if (formData.discountPlan === "variant")
        payload.variant = selectedItemId;

      await axiosSecure.post("/discount", payload);
      toast.success("Discount created successfully!");

      setFormData(emptyFormData);
      setSelectedType("");
      setSelectedItemId("");
      setImage(null);
      setPreview(null);
      setErrors({});
      sessionStorage.removeItem(scopedStorageKey(DRAFT_STORAGE_KEY));
    } catch (error: any) {
      showApiError(error, "Failed to create discount.");
    } finally {
      setIsLoading(false);
    }
  };

  const itemOptions =
    formData.discountPlan === "category"
      ? categories.map((c: any) => ({ label: c.name, value: c._id }))
      : formData.discountPlan === "subCategory"
        ? subCategories.map((s: any) => ({ label: s.name, value: s._id }))
        : formData.discountPlan === "product"
          ? products.map((p: any) => ({ label: p.name, value: p._id }))
          : variantProducts.map((p: any) => ({ label: p.name, value: p._id }));

  const itemLabel =
    formData.discountPlan === "category"
      ? "Select Category"
      : formData.discountPlan === "subCategory"
        ? "Select SubCategory"
        : formData.discountPlan === "product"
          ? "Select Product"
          : "Select Variant Product";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard icon={<FaTags />} title="Discount Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <Label>
                  Discount Name <Req />
                </Label>
                <Input
                  type="text"
                  placeholder="Enter discount name"
                  value={formData.discountName}
                  onChange={(e) =>
                    handleInputChange("discountName", e.target.value)
                  }
                  className={errors.discountName ? "border-red-500" : ""}
                />
                <FieldError msg={errors.discountName} />
              </div>
              <div>
                <Label>
                  Discount Plan <Req />
                </Label>
                <SearchableSelect
                  options={planOptions}
                  placeholder="Select plan"
                  searchPlaceholder="Search plans..."
                  value={formData.discountPlan}
                  onChange={handlePlanChange}
                  hasError={!!errors.discountPlan}
                />
                <FieldError msg={errors.discountPlan} />
              </div>
              <div>
                <Label>
                  Discount Type <Req />
                </Label>
                <SearchableSelect
                  options={typeOptions}
                  placeholder="Select type"
                  searchPlaceholder="Search types..."
                  value={selectedType}
                  onChange={handleTypeChange}
                  hasError={!!errors.discountType}
                />
                <FieldError msg={errors.discountType} />
              </div>
              {formData.discountPlan && formData.discountPlan !== "flat" && (
                <div className="md:col-span-2">
                  <Label>
                    {itemLabel} <Req />
                  </Label>
                  <SearchableSelect
                    options={itemOptions}
                    value={selectedItemId}
                    onChange={(value) => {
                      setSelectedItemId(value);
                      if (value)
                        setErrors((prev) => ({ ...prev, selectedItemId: "" }));
                    }}
                    placeholder={`Choose ${formData.discountPlan}`}
                    searchPlaceholder={`Search ${formData.discountPlan}s...`}
                    hasError={!!errors.selectedItemId}
                  />
                  <FieldError msg={errors.selectedItemId} />
                </div>
              )}
              {selectedType === "tk" && (
                <div>
                  <Label>
                    Discount Amount (Tk) <Req />
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={formData.discountValueByAmount}
                    onChange={(e) =>
                      handleInputChange("discountValueByAmount", e.target.value)
                    }
                    className={errors.discountValueByAmount ? "border-red-500" : ""}
                  />
                  <FieldError msg={errors.discountValueByAmount} />
                </div>
              )}
              {selectedType === "percentance" && (
                <div>
                  <Label>
                    Discount Percentage (%) <Req />
                  </Label>
                  <Input
                    type="number"
                    placeholder="Enter percentage"
                    value={formData.discountValueByPercentance}
                    onChange={(e) =>
                      handleInputChange(
                        "discountValueByPercentance",
                        e.target.value,
                      )
                    }
                    className={
                      errors.discountValueByPercentance ? "border-red-500" : ""
                    }
                  />
                  <FieldError msg={errors.discountValueByPercentance} />
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard icon={<FaCalendarAlt />} title="Validity Period">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <DatePicker
                  id="date-picker-from"
                  label="Valid From"
                  placeholder="Select start date"
                  defaultDate={formData.discountValidFrom || undefined}
                  onChange={(_, dateStr) =>
                    handleDateChange("discountValidFrom", dateStr)
                  }
                />
                <FieldError msg={errors.discountValidFrom} />
              </div>
              <div>
                <DatePicker
                  id="date-picker-to"
                  label="Valid To"
                  placeholder="Select end date"
                  defaultDate={formData.discountValidTo || undefined}
                  onChange={(_, dateStr) =>
                    handleDateChange("discountValidTo", dateStr)
                  }
                />
                <FieldError msg={errors.discountValidTo} />
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard icon={<FaImage />} title="Banner Image" className="self-start">
          <div
            {...getRootProps()}
            className={`relative flex flex-col items-center justify-center w-full min-h-[220px] border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
              ${isDragActive ? "border-accent-500 bg-accent-50 dark:bg-accent-500/5" : "border-gray-300 dark:border-gray-700 hover:border-accent-400"}
              ${preview ? "border-none p-0" : "p-6"}`}
          >
            <input {...getInputProps()} />
            {!preview ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 dark:bg-accent-500/10 mb-4">
                  <svg
                    className="h-6 w-6 text-accent-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {isDragActive
                    ? "Drop image here"
                    : "Click to upload or drag and drop"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  SVG, PNG, JPG or WEBP (Max: 5MB)
                </p>
              </div>
            ) : (
              <div className="relative w-full flex justify-center py-4">
                <div className="relative w-full max-w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-theme-md group">
                  <img
                    src={preview}
                    alt="Discount banner preview"
                    className="w-full h-48 object-cover bg-gray-50 dark:bg-gray-800 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      aria-label="Remove image"
                      title="Remove image"
                      className="shine bg-accent-500 text-white p-3 rounded-full hover:bg-accent-600 transform hover:scale-110 transition-all shadow-xl"
                    >
                      <TrashBinIcon className="size-5" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-black/80 px-3 py-1 rounded-full text-[10px] font-bold text-gray-800 dark:text-white backdrop-blur-sm">
                    {image?.name} ({((image?.size ?? 0) / 1024 / 1024).toFixed(2)}{" "}
                    MB)
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">Optional — shown with the discount on the storefront.</p>
        </SectionCard>
      </div>

      {/* ── Submit ─────────────────────────────────────────── */}
      <MobileActionBar>
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full sm:w-auto !bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 rounded-xl font-semibold text-sm shadow-theme-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Creating...</span>
            </div>
          ) : (
            "Create Discount"
          )}
        </Button>
      </div>
      </MobileActionBar>
    </div>
  );
};

export default CreateDiscountForm;
