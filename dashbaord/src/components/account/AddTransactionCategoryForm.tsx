import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import { FaChevronDown, FaArrowDown, FaArrowUp, FaCheck } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";

type AllowedType = "cash recived" | "cash payment" | "";

interface CategoryRow {
  name: string;
  allowedType: AllowedType;
}

interface RowErrors {
  name?: string;
  allowedType?: string;
}

const TYPE_OPTIONS: { value: Exclude<AllowedType, "">; label: string }[] = [
  { value: "cash recived", label: "Cash Received" },
  { value: "cash payment", label: "Cash Payment" },
];

// ---------- Styled transaction-type dropdown ----------
interface TypeDropdownProps {
  value: AllowedType;
  onChange: (val: AllowedType) => void;
  error?: string;
}

const TypeDropdown = ({ value, onChange, error }: TypeDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = TYPE_OPTIONS.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm text-left transition-colors ${
          error ? "border-red-500" : "border-gray-300 dark:border-gray-700"
        } ${open ? "ring-2 ring-brand-500/20 border-brand-500" : ""}`}
      >
        <span className={`flex items-center gap-2 ${selected ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>
          {selected?.value === "cash recived" && <FaArrowDown className="size-3 text-green-500" />}
          {selected?.value === "cash payment" && <FaArrowUp className="size-3 text-red-500" />}
          {selected ? selected.label : "Select type..."}
        </span>
        <FaChevronDown className={`size-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-left transition-colors ${
                value === opt.value
                  ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              <span className="flex items-center gap-2">
                {opt.value === "cash recived" ? (
                  <FaArrowDown className="size-3 text-green-500" />
                ) : (
                  <FaArrowUp className="size-3 text-red-500" />
                )}
                {opt.label}
              </span>
              {value === opt.value && <FaCheck className="size-3 text-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const AddTransactionCategoryForm = () => {
  const [categories, setCategories] = useState<CategoryRow[]>([{ name: "", allowedType: "" }]);
  const [errors, setErrors] = useState<RowErrors[]>([{}]);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (index: number, field: keyof CategoryRow, value: string) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], [field]: value };
    setCategories(updated);

    const updatedErrors = [...errors];
    updatedErrors[index] = { ...updatedErrors[index], [field]: undefined };
    setErrors(updatedErrors);
  };

  const handleAddField = () => {
    setCategories((p) => [...p, { name: "", allowedType: "" }]);
    setErrors((p) => [...p, {}]);
  };

  const handleRemoveField = (index: number) => {
    if (categories.length === 1) return;
    const updated = [...categories];
    updated.splice(index, 1);

    const updatedErrors = [...errors];
    updatedErrors.splice(index, 1);

    setCategories(updated);
    setErrors(updatedErrors);
  };

  const handleSubmit = async () => {
    const newErrors: RowErrors[] = categories.map((c) => ({
      name: c.name.trim() === "" ? "Category name is required" : undefined,
      allowedType: c.allowedType === "" ? "Transaction type is required" : undefined,
    }));
    setErrors(newErrors);

    if (newErrors.some((e) => e.name || e.allowedType)) {
      toast.error("Please fill in all category fields.");
      return;
    }

    setIsLoading(true);
    try {
      await axiosSecure.post(
        "/transaction-category/create-transaction-category",
        {
          categories: categories.map((c) => ({
            name: c.name.trim(),
            allowedType: c.allowedType,
          })),
        }
      );

      toast.success("Categories created successfully!");
      setCategories([{ name: "", allowedType: "" }]);
      setErrors([{}]);
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to create categories");
      } else {
        toast.error("Failed to create categories");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {categories.map((category, index) => (
        <div key={index} className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <Label>Category Name</Label>
              <Input
                type="text"
                placeholder={`Category ${index + 1}`}
                value={category.name}
                onChange={(e) => handleChange(index, "name", e.target.value)}
                className={`w-full border ${
                  errors[index]?.name
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300 dark:border-gray-700"
                }`}
              />
              {errors[index]?.name && (
                <p className="text-red-500 text-sm">{errors[index]?.name}</p>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-1">
              <Label>Transaction Type</Label>
              <TypeDropdown
                value={category.allowedType}
                onChange={(val) => handleChange(index, "allowedType", val)}
                error={errors[index]?.allowedType}
              />
              {errors[index]?.allowedType && (
                <p className="text-red-500 text-sm">{errors[index]?.allowedType}</p>
              )}
            </div>

            {categories.length > 1 && (
              <button
                onClick={() => handleRemoveField(index)}
                type="button"
                className="text-red-500 hover:text-red-700 text-sm mt-8"
              >
                ✖
              </button>
            )}
          </div>
        </div>
      ))}

      <MobileActionBar>
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="px-4 py-2 rounded"
            onClick={handleAddField}
          >
            + Add Another
          </Button>
          <Button
            className="text-[#1D4ED8] px-4 py-2 rounded"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                Submitting...
              </span>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
};

export default AddTransactionCategoryForm;
