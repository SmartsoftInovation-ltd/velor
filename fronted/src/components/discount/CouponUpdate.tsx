import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import toast from "react-hot-toast";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import DatePicker from "../form/date-picker";
import Button from "../ui/button/Button";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import Select from "../form/Select";
import axiosSecure from "../../hooks/useAxiosSecure";

interface Coupon {
  code: string;
  usageLimit: string | number;
  discountType: string;
  couponStartAt: string;
  expireAt: string;
  discountValue: string | number;
  isActive: boolean;
}

const CouponUpdate = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<Coupon>({
    code: "",
    usageLimit: "",
    discountType: "",
    couponStartAt: "",
    expireAt: "",
    discountValue: "",
    isActive: true,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedType, setSelectedType] = useState<string>("");

  const typeOptions = [
    { value: "fixed", label: "Tk" },
    { value: "percentage", label: "Percentage" },
  ];

  useEffect(() => {
    const fetchCoupon = async () => {
      try {
        const { data } = await axiosSecure.get(`/coupon/getallcoupon`);
        const allCoupons = data.data?.coupons || data.data || [];
        const fetchedCoupon = allCoupons.find((c: any) => c.slug === slug);
        
        if (fetchedCoupon) {
          setFormData({
            code: fetchedCoupon.code || "",
            usageLimit: fetchedCoupon.usageLimit || "",
            discountType: fetchedCoupon.discountType || "",
            couponStartAt: fetchedCoupon.couponStartAt || "",
            expireAt: fetchedCoupon.expireAt || "",
            discountValue: fetchedCoupon.discountValue || "",
            isActive: fetchedCoupon.isActive !== undefined ? fetchedCoupon.isActive : true,
          });
          setSelectedType(fetchedCoupon.discountType || "");
        } else {
          toast.error("Coupon not found.");
        }
      } catch (err) {
        console.error("Failed to fetch coupon details.", err);
        toast.error("Failed to fetch coupon details.");
      }
    };
    if (slug) {
      fetchCoupon();
    }
  }, [slug]);

  const handleTypeChange = (value: string) => {
    setSelectedType(value);
    setFormData((prev) => ({ ...prev, discountType: value }));
    if (value) setErrors((prev) => ({ ...prev, discountType: "" }));
  };

  const handleDateChange = (field: "expireAt" | "couponStartAt", date: string) => {
    setFormData((prev) => ({ ...prev, [field]: date }));
    if (date) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (value.trim()) setErrors((prev) => ({ ...prev, [field]: "" }));
  };
  
  const handleToggleActive = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, isActive: e.target.checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.code) newErrors.code = "Coupon code is required.";
    if (!formData.usageLimit) newErrors.usageLimit = "Usage limit is required.";
    if (!formData.discountType)
      newErrors.discountType = "Discount type is required.";
    if (!formData.couponStartAt) newErrors.couponStartAt = "Start date is required.";
    if (!formData.expireAt) newErrors.expireAt = "Expire date is required.";
    if (!formData.discountValue)
      newErrors.discountValue = "Discount value is required.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);

    try {
      const payload = {
        code: formData.code,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        couponStartAt: formData.couponStartAt,
        expireAt: formData.expireAt,
        isActive: formData.isActive,
      };

      await axiosSecure.put(`/coupon/update-coupon/${slug}`, payload);
      toast.success("Coupon updated successfully!");
      navigate("/coupon-list");
    } catch (error: any) {
      console.error("Error:", error.response?.data?.message || error.message);
      toast.error(error.response?.data?.message || "Failed to update coupon.");
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
      <PageBreadcrumb pageTitle="Update Coupon" />
      <div className="space-y-6">
        <ComponentCard title="Update Coupon">
          <form onSubmit={handleSubmit} className="space-y-8 mt-2">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col">
                <DatePicker
                  id="date-picker-start"
                  label="Coupon Start Date"
                  placeholder="Select a date"
                  defaultDate={formData.couponStartAt ? formData.couponStartAt.split("T")[0] : undefined}
                  onChange={(_, currentDateString) => {
                    handleDateChange("couponStartAt", currentDateString);
                  }}
                />
                {errors.couponStartAt && (
                  <p className="text-red-500 text-sm mt-1">{errors.couponStartAt}</p>
                )}
              </div>
              <div className="flex flex-col">
                <DatePicker
                  id="date-picker-to"
                  label="Coupon Expire Date"
                  placeholder="Select a date"
                  defaultDate={formData.expireAt ? formData.expireAt.split("T")[0] : undefined}
                  onChange={(_, currentDateString) => {
                    handleDateChange("expireAt", currentDateString);
                  }}
                />
                {errors.expireAt && (
                  <p className="text-red-500 text-sm mt-1">{errors.expireAt}</p>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Coupon Code Name:</Label>
                <Input
                  type="text"
                  id="code"
                  placeholder="Enter Coupon Code name"
                  value={String(formData.code)}
                  onChange={(e) => handleInputChange("code", e.target.value)}
                  className={errors.code ? "border-red-500" : ""}
                />
                {errors.code && (
                  <p className="text-red-500 text-sm mt-1">{errors.code}</p>
                )}
              </div>
              
              <div className="flex flex-col gap-2">
                <Label htmlFor="usageLimit">Coupon Usage Limit:</Label>
                <Input
                  type="text"
                  id="usageLimit"
                  placeholder="Enter Coupon Usage Limit"
                  value={String(formData.usageLimit)}
                  onChange={(e) => handleInputChange("usageLimit", e.target.value)}
                  className={errors.usageLimit ? "border-red-500" : ""}
                />
                {errors.usageLimit && (
                  <p className="text-red-500 text-sm mt-1">{errors.usageLimit}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Select Discount Type</Label>
                <Select
                  options={typeOptions}
                  placeholder="Select Option"
                  value={selectedType}
                  onChange={handleTypeChange}
                  className={errors.discountType ? "border-red-500" : ""}
                />
                {errors.discountType && (
                  <p className="text-red-500 text-sm mt-1">{errors.discountType}</p>
                )}
              </div>

              {selectedType && (
                <div className="flex flex-col gap-2">
                  <Label>
                    Discount Value ({selectedType === "fixed" ? "Tk" : "%"})
                  </Label>
                  <Input
                    type="number"
                    placeholder={
                      selectedType === "fixed"
                        ? "Enter Discount Amount (Tk)"
                        : "Enter Discount Percentage"
                    }
                    value={String(formData.discountValue)}
                    onChange={(e) =>
                      handleInputChange("discountValue", e.target.value)
                    }
                    className={errors.discountValue ? "border-red-500" : ""}
                  />
                  {errors.discountValue && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.discountValue}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700 w-max">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleToggleActive}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-500"></div>
                <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {formData.isActive ? "Status: Active" : "Status: Inactive"}
                </span>
              </label>
            </div>

            <div className="pt-6 border-t border-gray-100 dark:border-gray-800/50">
              <Button disabled={loading} className="w-full md:w-auto px-8 h-12 text-sm font-medium transition-all active:scale-95 bg-blue-500 hover:bg-blue-600 text-white rounded">
                {loading ? "Updating..." : "Update Coupon"}
              </Button>
            </div>
          </form>
        </ComponentCard>
      </div>
    </>
  );
};

export default CouponUpdate;
