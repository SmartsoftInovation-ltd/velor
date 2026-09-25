import { useState } from "react";
import toast from "react-hot-toast";
import axios from "axios";
import { FaTags, FaPlus, FaTrash } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import SectionCard from "../common/SectionCard";
import SearchableSelect from "../form/SearchableSelect";

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
      <SectionCard
        icon={<FaTags />}
        title="Transaction Categories"
        action={
          <button
            type="button"
            onClick={handleAddField}
            className="shine inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 text-xs font-semibold transition-colors"
          >
            <FaPlus className="size-3" />
            Add Another
          </button>
        }
      >
        <div className="space-y-5">
          {categories.map((category, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-5 items-start"
            >
              <div className="flex flex-col gap-1">
                <Label htmlFor={`category-name-${index}`}>Category Name</Label>
                <Input
                  id={`category-name-${index}`}
                  type="text"
                  placeholder={`Category ${index + 1}`}
                  value={category.name}
                  onChange={(e) => handleChange(index, "name", e.target.value)}
                  className={errors[index]?.name ? "border-red-500" : ""}
                />
                {errors[index]?.name && (
                  <p className="text-red-500 text-xs mt-0.5">{errors[index]?.name}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label>Transaction Type</Label>
                <SearchableSelect
                  options={TYPE_OPTIONS}
                  value={category.allowedType}
                  onChange={(val) => handleChange(index, "allowedType", val)}
                  placeholder="Select type"
                  searchPlaceholder="Search types..."
                  hasError={!!errors[index]?.allowedType}
                />
                {errors[index]?.allowedType && (
                  <p className="text-red-500 text-xs mt-0.5">{errors[index]?.allowedType}</p>
                )}
              </div>

              {categories.length > 1 ? (
                <button
                  type="button"
                  onClick={() => handleRemoveField(index)}
                  aria-label={`Remove category ${index + 1}`}
                  className="shine md:mt-7 flex size-10 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                >
                  <FaTrash className="size-4" />
                </button>
              ) : (
                <span className="hidden md:block size-10" />
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <MobileActionBar>
        <div className="flex justify-end pt-2">
          <Button
            className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold px-8 py-2.5 !rounded-xl disabled:opacity-60"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Submitting...
              </span>
            ) : (
              "Create Categories"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
};

export default AddTransactionCategoryForm;
