import { useState, useMemo } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SearchableSelect from "../form/SearchableSelect";
import { showApiError } from "../../utils/apiError";
import MobileActionBar from "../common/MobileActionBar";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "create-subcategory";


interface Category {
  _id: string;
  name: string;
  id: string;
}

const CreateSubCategoryForm = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>(() => draftValue<string>(DRAFT_KEY, "selectedCategory", ""));
  const [subCategoryName, setSubCategoryName] = useState<string>(() => draftValue<string>(DRAFT_KEY, "subCategoryName", ""));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ selectedCategory, subCategoryName }), [selectedCategory, subCategoryName]),
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{
    category?: string;
    subCategory?: string;
  }>({});

  const { data: categoriesData } = useQuery({
    queryKey: ["categories_list"],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/categories`);
      return data.data.categories;
    }
  });

  const categories = categoriesData || [];

  const handleSubCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSubCategoryName(e.target.value);
    if (e.target.value.trim()) {
      setErrors((prev) => ({ ...prev, subCategory: undefined }));
    }
  };

  const handleSubmit = async () => {
    const newErrors: { category?: string; subCategory?: string } = {};

    if (!selectedCategory) {
      newErrors.category = "Category is required.";
    }
    if (!subCategoryName.trim()) {
      newErrors.subCategory = "Subcategory name is required.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);

    const payload = {
      name: subCategoryName,
      category: selectedCategory, // MongoDB ObjectId string
    };

    try {
      await axiosSecure.post(`/subcategories`, payload, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      toast.success("Subcategory created successfully!");
      clearDraft(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] }); // Categories might include subcategories
      setSubCategoryName("");
      setSelectedCategory("");
      setErrors({});
    } catch (error: any) {
      showApiError(error, "Failed to create subcategory");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm w-full">
      <div className="space-y-6">
        {/* Category Select */}
        <div>
          <Label htmlFor="category" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
            Select Parent Category
          </Label>
          <div className="relative group">
            <SearchableSelect
              options={categories.map((cat: Category) => ({
                value: cat._id,
                label: cat.name,
              }))}
              value={selectedCategory}
              onChange={(val) => {
                setSelectedCategory(val);
                if (val) {
                  setErrors((prev) => ({ ...prev, category: undefined }));
                }
              }}
              placeholder="Choose a Category"
              searchPlaceholder="Search categories..."
              hasError={!!errors.category}
            />
          </div>
          {errors.category && (
            <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.category}</p>
          )}
        </div>

        {/* Subcategory Name */}
        <div>
          <Label htmlFor="subcategory-name" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
            Subcategory Name
          </Label>
          <Input
            value={subCategoryName}
            onChange={handleSubCategoryChange}
            type="text"
            id="subcategory-name"
            placeholder="e.g. T-Shirts, Electronics, etc."
            className={errors.subCategory ? "border-red-500 focus:border-red-500 shadow-sm shadow-red-500/5" : ""}
          />
          {errors.subCategory && (
            <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.subCategory}</p>
          )}
        </div>

        {/* Action Button */}
        <MobileActionBar>
        <div className="flex justify-end pt-2">
            <Button
              className="w-full sm:w-auto !bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 rounded-xl transition-all duration-200 shadow-theme-md font-semibold text-sm tracking-wide transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </div>
              ) : (
                "Create Subcategory"
              )}
            </Button>
        </div>
        </MobileActionBar>
      </div>
    </div>
  );
};

export default CreateSubCategoryForm;
