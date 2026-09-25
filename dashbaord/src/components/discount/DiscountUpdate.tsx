import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import toast from "react-hot-toast";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import DatePicker from "../form/date-picker";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import Select from "../form/Select";
import SearchableSelect from "../form/SearchableSelect";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import axiosSecure from "../../hooks/useAxiosSecure";
import { showApiError } from "../../utils/apiError";

const DiscountUpdate = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedItemId, setSelectedItemId] = useState<string>("");

  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [variantProducts, setVariantProducts] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    discountName: "",
    discountPlan: "",
    discountType: "",
    discountValidFrom: "",
    discountValidTo: "",
    discountValueByAmount: "",
    discountValueByPercentance: "",
    isActive: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const typeOptions = [
    { value: "tk", label: "Tk" },
    { value: "percentance", label: "Percentage" },
  ];

  const planOptions = [
    { value: "flat", label: "Flat" },
    { value: "category", label: "Category" },
    { value: "subCategory", label: "SubCategory" },
    { value: "product", label: "Product" },
    { value: "variant", label: "Variant" },
  ];

  const fetchOptionsForPlan = async (plan: string) => {
    try {
      if (plan === "category") {
        const res = await axiosSecure.get(`/categories`);
        setCategories(res.data.data.categories || []);
      } else if (plan === "subCategory") {
        const res = await axiosSecure.get(`/subcategories`);
        setSubCategories(res.data.data.subCategories || res.data.data || []);
      } else if (plan === "product") {
        const res = await axiosSecure.get(`/product/getproduct`);
        const allProducts = res.data?.data?.products || res.data?.data || [];
        const safeArray = Array.isArray(allProducts) ? allProducts : [];
        setProducts(safeArray.filter((p: any) => p.variantType === "singleVariant"));
      } else if (plan === "variant") {
        const res = await axiosSecure.get(`/product/multiplevarinatproduct`);
        setVariantProducts(res.data.data?.products || []);
      }
    } catch (error) {
      console.error("Failed to fetch options:", error);
    }
  };

  useEffect(() => {
    const fetchDiscount = async () => {
      try {
        const { data } = await axiosSecure.get(`/discount/${slug}`);
        const fetchedDiscount = data.data?.discount || data.data || {};
        
        setFormData({
          discountName: fetchedDiscount.discountName || "",
          discountPlan: fetchedDiscount.discountPlan || "",
          discountType: fetchedDiscount.discountType || "",
          discountValidFrom: fetchedDiscount.discountValidFrom || "",
          discountValidTo: fetchedDiscount.discountValidTo || "",
          discountValueByAmount: fetchedDiscount.discountValueByAmount || "",
          discountValueByPercentance: fetchedDiscount.discountValueByPercentance || "",
          isActive: fetchedDiscount.isActive ?? true,
        });

        setSelectedType(fetchedDiscount.discountType || "");
        
        if (fetchedDiscount.discountPlan && fetchedDiscount.discountPlan !== "flat") {
          await fetchOptionsForPlan(fetchedDiscount.discountPlan);
          
          if (fetchedDiscount.discountPlan === "category" && fetchedDiscount.category) {
            setSelectedItemId(fetchedDiscount.category._id || fetchedDiscount.category);
          } else if (fetchedDiscount.discountPlan === "subCategory" && fetchedDiscount.subCategory) {
            setSelectedItemId(fetchedDiscount.subCategory._id || fetchedDiscount.subCategory);
          } else if (fetchedDiscount.discountPlan === "product" && fetchedDiscount.product) {
            setSelectedItemId(fetchedDiscount.product._id || fetchedDiscount.product);
          } else if (fetchedDiscount.discountPlan === "variant" && fetchedDiscount.variant) {
            setSelectedItemId(fetchedDiscount.variant._id || fetchedDiscount.variant);
          }
        }
      } catch (error) {
        showApiError(error, "Failed to fetch discount details.");
      }
    };
    if (slug) {
      fetchDiscount();
    }
  }, [slug]);

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setFormData((prev) => ({ ...prev, discountType: value }));
    if (value) setErrors((prev) => ({ ...prev, discountType: "" }));
  };

  const handlePlanChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, discountPlan: value }));
    setSelectedItemId("");
    if (value) setErrors((prev) => ({ ...prev, discountPlan: "" }));
    await fetchOptionsForPlan(value);
  };

  const handleDateChange = (
    field: "discountValidFrom" | "discountValidTo",
    date: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: date }));
    if (date) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (value.trim()) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, isActive: e.target.checked }));
  };

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

    if (formData.discountType === "tk" && !formData.discountValueByAmount) {
      newErrors.discountValueByAmount = "Amount is required.";
    }
    if (
      formData.discountType === "percentance" &&
      !formData.discountValueByPercentance
    ) {
      newErrors.discountValueByPercentance = "Percentage is required.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);

    try {
      const payload: any = {
        discountName: formData.discountName,
        discountPlan: formData.discountPlan,
        discountType: formData.discountType,
        discountValidFrom: formData.discountValidFrom,
        discountValidTo: formData.discountValidTo,
        isActive: formData.isActive,
      };

      if (formData.discountType === "tk") {
        payload.discountValueByAmount = Number(formData.discountValueByAmount);
      } else if (formData.discountType === "percentance") {
        payload.discountValueByPercentance = Number(
          formData.discountValueByPercentance
        );
      }

      if (formData.discountPlan === "category") {
        payload.category = selectedItemId;
      } else if (formData.discountPlan === "subCategory") {
        payload.subCategory = selectedItemId;
      } else if (formData.discountPlan === "product") {
        payload.product = selectedItemId;
      } else if (formData.discountPlan === "variant") {
        payload.variant = selectedItemId;
      }

      await axiosSecure.put(`/discount/${slug}`, payload);

      toast.success("Discount Updated Successfully!");
      navigate("/discount-list"); 
    } catch (error: any) {
      console.error("Error:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || "Failed to update discount.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Update Discount" />
      <div className="space-y-6">
        <ComponentCard title="Discount Update">
          <div className="space-y-8 mt-2">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="discountName">Discount Name</Label>
                <Input
                  type="text"
                  id="discountName"
                  placeholder="Enter Discount name"
                  value={formData.discountName}
                  onChange={(e) => handleInputChange("discountName", e.target.value)}
                  className={errors.discountName ? "border-red-500" : ""}
                />
                {errors.discountName && (
                  <p className="text-red-500 text-sm mt-1">{errors.discountName}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Select Discount Plan</Label>
                <Select
                  options={planOptions}
                  value={formData.discountPlan}
                  placeholder="Select Option"
                  onChange={handlePlanChange}
                  className={errors.discountPlan ? "border-red-500" : ""}
                />
                {errors.discountPlan && (
                  <p className="text-red-500 text-sm mt-1">{errors.discountPlan}</p>
                )}
              </div>

              {formData.discountPlan && formData.discountPlan !== "flat" && (
                <div className="flex flex-col gap-2">
                  <Label>
                    {formData.discountPlan === "category"
                      ? "Select Category"
                      : formData.discountPlan === "subCategory"
                      ? "Select SubCategory"
                      : formData.discountPlan === "product"
                      ? "Select Product"
                      : "Select Variant Product"}
                  </Label>
                  <SearchableSelect
                    options={
                      formData.discountPlan === "category"
                        ? (categories || []).map((cat: any) => ({
                            label: cat.name,
                            value: cat._id,
                          }))
                        : formData.discountPlan === "subCategory"
                        ? (subCategories || []).map((sub: any) => ({
                            label: sub.name,
                            value: sub._id,
                          }))
                        : formData.discountPlan === "product"
                        ? (products || []).map((prod: any) => ({
                            label: prod.name,
                            value: prod._id,
                          }))
                        : (variantProducts || []).map((prod: any) => ({
                            label: prod.name,
                            value: prod._id,
                          }))
                    }
                    value={selectedItemId}
                    onChange={(value) => {
                      setSelectedItemId(value);
                      if (value)
                        setErrors((prev) => ({ ...prev, selectedItemId: "" }));
                    }}
                    placeholder={
                      formData.discountPlan === "category"
                        ? "Choose Category"
                        : formData.discountPlan === "subCategory"
                        ? "Choose SubCategory"
                        : formData.discountPlan === "product"
                        ? "Choose Product"
                        : "Choose Variant Product"
                    }
                    searchPlaceholder={
                      formData.discountPlan === "category"
                        ? "Search categories..."
                        : formData.discountPlan === "subCategory"
                        ? "Search subcategories..."
                        : formData.discountPlan === "product"
                        ? "Search products..."
                        : "Search variant products..."
                    }
                    hasError={!!errors.selectedItemId}
                  />
                  {errors.selectedItemId && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.selectedItemId}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Label>Select Discount Type</Label>
                <Select
                  options={typeOptions}
                  value={formData.discountType}
                  placeholder="Select Option"
                  onChange={handleTypeChange}
                  className={errors.discountType ? "border-red-500" : ""}
                />
                {errors.discountType && (
                  <p className="text-red-500 text-sm mt-1">{errors.discountType}</p>
                )}
              </div>
              
              {selectedType === "tk" && (
                <div className="flex flex-col gap-2">
                  <Label>Discount Value (Tk)</Label>
                  <Input
                    type="number"
                    placeholder="Enter Discount Amount (Tk)"
                    value={formData.discountValueByAmount}
                    onChange={(e) =>
                      handleInputChange("discountValueByAmount", e.target.value)
                    }
                    className={errors.discountValueByAmount ? "border-red-500" : ""}
                  />
                  {errors.discountValueByAmount && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.discountValueByAmount}
                    </p>
                  )}
                </div>
              )}

              {selectedType === "percentance" && (
                <div className="flex flex-col gap-2">
                  <Label>Discount Value (%)</Label>
                  <Input
                    type="number"
                    placeholder="Enter Discount Percentage"
                    value={formData.discountValueByPercentance}
                    onChange={(e) =>
                      handleInputChange("discountValueByPercentance", e.target.value)
                    }
                    className={
                      errors.discountValueByPercentance ? "border-red-500" : ""
                    }
                  />
                  {errors.discountValueByPercentance && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.discountValueByPercentance}
                    </p>
                  )}
                </div>
              )}
              
              <div className="flex flex-col gap-2" key={`from-${formData.discountValidFrom}`}>
                <DatePicker
                  id="date-picker-from"
                  label="Discount Valid From"
                  placeholder="Select a date"
                  defaultDate={formData.discountValidFrom ? formData.discountValidFrom.split("T")[0] : undefined}
                  onChange={(_, currentDateString) => {
                    handleDateChange("discountValidFrom", currentDateString);
                  }}
                />
                {errors.discountValidFrom && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.discountValidFrom}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col gap-2" key={`to-${formData.discountValidTo}`}>
                <DatePicker
                  id="date-picker-to"
                  label="Discount Valid To"
                  placeholder="Select a date"
                  defaultDate={formData.discountValidTo ? formData.discountValidTo.split("T")[0] : undefined}
                  onChange={(_, currentDateString) => {
                    handleDateChange("discountValidTo", currentDateString);
                  }}
                />
                {errors.discountValidTo && (
                  <p className="text-red-500 text-sm mt-1">
                    {errors.discountValidTo}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700 w-max">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleCheckboxChange}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-accent-500"></div>
                <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formData.isActive ? "Status: Active" : "Status: Inactive"}
                </span>
              </label>
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800/50">
              <MobileActionBar>
                <Button onClick={handleSubmit} disabled={loading} className="w-full md:w-auto px-8 h-12 text-sm font-semibold rounded-xl !bg-accent-500 hover:!bg-accent-600 !text-white transition-all active:scale-95 disabled:opacity-50">
                  {loading ? <span className="flex items-center justify-center gap-2"><span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Updating...</span> : "Update Discount"}
                </Button>
              </MobileActionBar>
            </div>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default DiscountUpdate;
