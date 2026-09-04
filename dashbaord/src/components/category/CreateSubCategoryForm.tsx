import {  useState, useRef } from "react";
import { createPortal } from "react-dom";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import SearchableSelect from "../form/SearchableSelect";
import { showApiError } from "../../utils/apiError";

// Portal-based Tooltip component
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
    <div ref={ref} onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)} className="relative inline-block">
      {children}
      {visible && createPortal(
        <div 
          className="fixed z-[9999] px-3 py-1.5 text-[11px] font-bold text-white bg-gray-900 dark:bg-gray-800 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in duration-200"
          style={{ left: coords.x, top: coords.y }}
        >
          {text}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900 dark:border-t-gray-800" />
        </div>,
        document.body
      )}
    </div>
  );
};

interface Category {
  _id: string;
  name: string;
  id: string;
}

const CreateSubCategoryForm = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [subCategoryName, setSubCategoryName] = useState<string>("");
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
        <div className="flex justify-end pt-2">
          <Tooltip text="Click to create subcategory">
            <Button
              className="w-full sm:w-auto bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-8 py-3 rounded-xl transition-all duration-200 shadow-theme-md font-normal text-sm tracking-wide transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
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
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default CreateSubCategoryForm;
