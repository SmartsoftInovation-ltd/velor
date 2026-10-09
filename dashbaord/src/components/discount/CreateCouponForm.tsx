import { useState, useMemo } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { showApiError } from "../../utils/apiError";
import DatePicker from "../form/date-picker";
import SearchableSelect from "../form/SearchableSelect";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import MobileActionBar from "../common/MobileActionBar";
import SectionCard from "../common/SectionCard";
import { FaTicketAlt, FaCalendarAlt } from "react-icons/fa";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "create-coupon";

const CreateCouponForm = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedType, setSelectedType] = useState<string>(() => draftValue<string>(DRAFT_KEY, "selectedType", ""));

  const [formData, setFormData] = useState(() => draftValue(DRAFT_KEY, "formData", {
    code: "",
    usageLimit: "",
    discountType: "",
    couponStartAt: "",
    expireAt: "",
    discountValue: "",
  }));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ selectedType, formData }), [selectedType, formData]),
  );

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
      clearDraft(DRAFT_KEY);

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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard icon={<FaTicketAlt />} title="Coupon Details" className="lg:col-span-2 self-start">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col">
              <Label htmlFor="code">Coupon Code <span className="text-red-500">*</span></Label>
              <Input
                type="text"
                id="code"
                placeholder="Enter Coupon Code name"
                value={formData.code}
                onChange={(e) => handleInputChange("code", e.target.value)}
                className={errors.code ? "border-red-500" : ""}
              />
              {errors.code && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.code}</p>
              )}
            </div>
            <div className="flex flex-col">
              <Label htmlFor="usageLimit">Usage Limit</Label>
              <Input
                type="number"
                id="usageLimit"
                placeholder="Enter Coupon Usage Limit"
                value={formData.usageLimit}
                onChange={(e) => handleInputChange("usageLimit", e.target.value)}
                className={errors.usageLimit ? "border-red-500" : ""}
              />
              {errors.usageLimit && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.usageLimit}</p>
              )}
            </div>
            <div className="flex flex-col">
              <Label>Discount Type <span className="text-red-500">*</span></Label>
              <SearchableSelect
                options={typeOptions}
                placeholder="Select type"
                searchPlaceholder="Search types..."
                value={selectedType}
                onChange={handleTypeChange}
                hasError={!!errors.discountType}
              />
              {errors.discountType && (
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.discountType}</p>
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
                  <p className="text-red-500 text-xs mt-1 font-medium">
                    {errors.discountValue}
                  </p>
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard icon={<FaCalendarAlt />} title="Validity Period" className="self-start">
          <div className="grid grid-cols-1 gap-5">
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
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.couponStartAt}</p>
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
                <p className="text-red-500 text-xs mt-1 font-medium">{errors.expireAt}</p>
              )}
            </div>
          </div>
        </SectionCard>
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
