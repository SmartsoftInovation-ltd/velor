import { useState } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { showApiError } from "../../utils/apiError";
import DatePicker from "../form/date-picker";
import Select from "../form/Select";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import MobileActionBar from "../common/MobileActionBar";

const CreateCouponForm = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<string>("");

  const [formData, setFormData] = useState({
    code: "",
    usageLimit: "",
    discountType: "",
    couponStartAt: "",
    expireAt: "",
    discountValue: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const typeOptions = [
    { value: "fixed", label: "Tk" },
    { value: "percentage", label: "Percentage" },
  ];

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

  const handleSubmit = async () => {
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

    setIsLoading(true);

    try {
      const payload = {
        code: formData.code,
        usageLimit: Number(formData.usageLimit),
        discountType: formData.discountType, // "percentage" or "fixed"
        discountValue: Number(formData.discountValue),
        couponStartAt: formData.couponStartAt,
        expireAt: formData.expireAt,
      };

      await axiosSecure.post(`/coupon/create`, payload);

      toast.success("Coupon Created Successfully!");

      // Reset
      setFormData({
        code: "",
        usageLimit: "",
        discountType: "",
        couponStartAt: "",
        expireAt: "",
        discountValue: "",
      });
      setSelectedType("");
      setErrors({});
    } catch (error) {
      showApiError(error, "Failed to create coupon.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <DatePicker
            id="date-picker-start"
            label="Coupon Start Date"
            placeholder="Select a date"
            onChange={(_, currentDateString) => {
              handleDateChange("couponStartAt", currentDateString);
            }}
          />
          {errors.couponStartAt && (
            <p className="text-red-500 text-sm mt-1">{errors.couponStartAt}</p>
          )}
        </div>
        <div>
          <DatePicker
            id="date-picker-to"
            label="Coupon Expire Date"
            placeholder="Select a date"
            onChange={(_, currentDateString) => {
              handleDateChange("expireAt", currentDateString);
            }}
          />
          {errors.expireAt && (
            <p className="text-red-500 text-sm mt-1">{errors.expireAt}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col">
          <Label htmlFor="name">Coupon Code Name:</Label>
          <Input
            type="text"
            id="code"
            placeholder="Enter Coupon Code name"
            value={formData.code}
            onChange={(e) => handleInputChange("code", e.target.value)}
            className={errors.code ? "border-red-500" : ""}
          />
          {errors.code && (
            <p className="text-red-500 text-sm mt-1">{errors.code}</p>
          )}
        </div>
        <div className="flex flex-col">
          <Label htmlFor="usageLimit">Coupon Usage Limit:</Label>
          <Input
            type="text"
            id="usageLimit"
            placeholder="Enter Coupon Usage Limit"
            value={formData.usageLimit}
            onChange={(e) => handleInputChange("usageLimit", e.target.value)}
            className={errors.usageLimit ? "border-red-500" : ""}
          />
          {errors.usageLimit && (
            <p className="text-red-500 text-sm mt-1">{errors.usageLimit}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col">
          <Label>Select Discount Type</Label>
          <Select
            options={typeOptions}
            placeholder="Select Option"
            onChange={handleTypeChange}
            className={errors.discountType ? "border-red-500" : ""}
          />
          {errors.discountType && (
            <p className="text-red-500 text-sm mt-1">{errors.discountType}</p>
          )}
        </div>

        {selectedType && (
          <div className="flex flex-col">
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
              value={formData.discountValue}
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

      <MobileActionBar>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            className="w-full sm:w-auto !bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 rounded-xl font-semibold text-sm shadow-theme-md transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Creating...</span>
              </div>
            ) : (
              "Create Coupon"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
};

export default CreateCouponForm;
