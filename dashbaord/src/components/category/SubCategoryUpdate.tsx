import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import { useNavigate, useParams, Link } from "react-router";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft } from "react-icons/fa";
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




const SubCategoryUpdate = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [subCategoryName, setSubCategoryName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ category?: string; subCategory?: string }>({});

  const { data: categoriesData } = useQuery({
    queryKey: ["categories_list"],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/categories`);
      return data.data.categories;
    }
  });

  const categories = categoriesData || [];

  const { data: subCategoryData, isLoading: isSubCategoryLoading } = useQuery({
    queryKey: ["subcategory", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await axiosSecure.get(`/subcategories/${slug}`);
      return data.data.subCategories;
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (subCategoryData) {
      setSubCategoryName(subCategoryData.name);
      setSelectedCategory(subCategoryData.category._id);
    }
  }, [subCategoryData]);

  const isFetching = isSubCategoryLoading;

  const handleSubmit = async () => {
    const newErrors: { category?: string; subCategory?: string } = {};
    if (!selectedCategory) newErrors.category = "Category is required.";
    if (!subCategoryName.trim()) newErrors.subCategory = "Subcategory name is required.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);
    const payload = {
      name: subCategoryName,
      category: selectedCategory,
    };

    try {
      await axiosSecure.put(`/subcategories/${slug}`, payload);
      toast.success("Subcategory updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["subcategories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      navigate("/subcategory-list");
    } catch (error: any) {
      showApiError(error, "Failed to update subcategory");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Update Subcategory | Baig Digital"
        description="Update your subcategory information"
      />
      <PageBreadcrumb pageTitle="Update Subcategory" />
      
      <div className="w-full space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3">
                <Tooltip text="Go Back">
                  <Button
                    onClick={() => navigate(-1)}
                    size="sm"
                    variant="outline"
                    aria-label="Go back"
                    className="size-10 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-accent-600 transition-all active:scale-90"
                  >
                    <FaArrowLeft className="size-4" />
                  </Button>
                </Tooltip>
                <h2 className="text-md font-medium text-gray-800 dark:text-white/90">Update Subcategory</h2>
              </div>
              <Tooltip text="View List">
                <Link to="/subcategory-list">
                  <Button size="sm" className="!bg-accent-500 hover:!bg-accent-600 !text-white px-4 py-2 rounded-lg shadow-lg shadow-accent-500/20">
                    SubCategory List
                  </Button>
                </Link>
              </Tooltip>
            </div>
          }
        >
          {isFetching ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="size-12 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
              <p className="text-gray-500 font-medium animate-pulse">Loading data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Category Select */}
              <div>
                <Label htmlFor="category" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
                  Parent Category <span className="text-red-500">*</span>
                </Label>
                <div className="relative group">
                  <select
                    id="category"
                    className={`
                      w-full h-11 px-4 py-2 bg-white dark:bg-gray-800 border rounded-xl text-sm transition-all duration-200 outline-none
                      appearance-none cursor-pointer focus:ring-2 focus:ring-accent-500/20
                      ${errors.category ? "border-red-500 focus:border-red-500" : "border-gray-200 dark:border-gray-700 focus:border-accent-500"}
                    `}
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      if (e.target.value) setErrors(p => ({ ...p, category: undefined }));
                    }}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((cat: { _id: string, name: string }) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-accent-500 transition-colors">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors.category && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.category}</p>
                )}
              </div>

              {/* Subcategory Name */}
              <div>
                <Label htmlFor="subcategory-name" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
                  Subcategory Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={subCategoryName}
                  onChange={(e) => {
                    setSubCategoryName(e.target.value);
                    if (e.target.value.trim()) setErrors(p => ({ ...p, subCategory: undefined }));
                  }}
                  type="text"
                  id="subcategory-name"
                  placeholder="Enter subcategory name"
                  className={errors.subCategory ? "border-red-500" : ""}
                />
                {errors.subCategory && (
                  <p className="text-red-500 text-xs mt-1.5 font-medium">{errors.subCategory}</p>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <Tooltip text="Save changes">
                  <Button
                    onClick={handleSubmit}
                    disabled={isLoading}
                      className="w-full sm:w-auto !bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 rounded-xl transition-all duration-200 shadow-theme-md font-bold text-sm tracking-wide transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Saving...</span>
                      </div>
                    ) : (
                      "Update Subcategory"
                    )}
                  </Button>
                </Tooltip>
              </div>
            </div>
          )}
        </ComponentCard>
      </div>
    </>
  );
};

export default SubCategoryUpdate;
