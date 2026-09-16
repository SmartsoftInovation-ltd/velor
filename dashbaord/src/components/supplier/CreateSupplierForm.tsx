import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

const CreateSupplierForm = () => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    supplierName: "",
    contactPersonName: "",
    contactPersonDesignation: "",
    mobile: "",
    supplierAddress: "",
    openingDues: "",
  });
  const [errors, setErrors] = useState<{
    supplierName?: string;
    mobile?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;

  const handleSubmit = async () => {
    const newErrors: { supplierName?: string; mobile?: string } = {};
    if (!formData.supplierName.trim())
      newErrors.supplierName = "Supplier name is required";
    if (!formData.mobile.trim()) {
      newErrors.mobile = "Mobile number is required";
    } else if (!BD_MOBILE_REGEX.test(formData.mobile.trim())) {
      newErrors.mobile = "Enter a valid BD mobile number (e.g. 01712345678)";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await axiosSecure.post("/supplier/addsupplier", {
        ...formData,
        openingDues: formData.openingDues ? Number(formData.openingDues) : 0,
      });
      toast.success("Supplier created successfully");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setFormData({
        supplierName: "",
        contactPersonName: "",
        contactPersonDesignation: "",
        mobile: "",
        supplierAddress: "",
        openingDues: "",
      });
      setErrors({});
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create supplier");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Row 1 — Supplier Name + Mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="supplierName">
            Supplier Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="supplierName"
            type="text"
            placeholder="Enter Supplier Name"
            value={formData.supplierName}
            className={errors.supplierName ? "border-red-500" : ""}
            onChange={(e) => {
              handleChange("supplierName", e.target.value);
              setErrors((prev) => ({ ...prev, supplierName: "" }));
            }}
          />
          {errors.supplierName && (
            <p className="text-red-500 text-xs">{errors.supplierName}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="mobile">
            Mobile <span className="text-red-500">*</span>
          </Label>
          <Input
            id="mobile"
            type="text"
            placeholder="01XXXXXXXXX"
            value={formData.mobile}
            className={errors.mobile ? "border-red-500" : ""}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              handleChange("mobile", val);
              setErrors((prev) => ({ ...prev, mobile: "" }));
            }}
          />
          {errors.mobile ? (
            <p className="text-red-500 text-xs">{errors.mobile}</p>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              11-digit BD number starting with 013–019
            </p>
          )}
        </div>
      </div>

      {/* Row 2 — Contact Person Name + Designation + Opening Dues */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="contactPersonName">Contact Person Name</Label>
          <Input
            id="contactPersonName"
            type="text"
            placeholder="Enter Contact Person Name"
            value={formData.contactPersonName}
            onChange={(e) => handleChange("contactPersonName", e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="contactPersonDesignation">
            Contact Person Designation
          </Label>
          <Input
            id="contactPersonDesignation"
            type="text"
            placeholder="Enter Contact Person Designation"
            value={formData.contactPersonDesignation}
            onChange={(e) =>
              handleChange("contactPersonDesignation", e.target.value)
            }
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="openingDues">Opening Dues</Label>
          <div className="relative w-full">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-medium select-none">
              ৳
            </span>
            <Input
              id="openingDues"
              type="number"
              placeholder="0.00"
              value={formData.openingDues}
              onChange={(e) => handleChange("openingDues", e.target.value)}
              className="pl-7"
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Leave blank or enter 0 if no outstanding dues at the start.
          </p>
        </div>
      </div>

      {/* Row 3 — Supplier Address (full width textarea) */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="supplierAddress">Supplier Address</Label>
        <textarea
          id="supplierAddress"
          rows={3}
          placeholder="Enter Supplier Address"
          value={formData.supplierAddress}
          onChange={(e) => handleChange("supplierAddress", e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
            className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-6 py-2 rounded-xl"
        >
          {isLoading ? "Creating..." : "Create Supplier"}
        </Button>
      </div>
    </div>
  );
};

export default CreateSupplierForm;
