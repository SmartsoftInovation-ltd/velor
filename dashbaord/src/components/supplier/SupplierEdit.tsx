import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { Link } from "react-router";

const SupplierEdit = () => {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    supplierName: "",
    contactPersonName: "",
    contactPersonDesignation: "",
    mobile: "",
    supplierAddress: "",
    openingDues: "",
    initialDue: "",
  });
  const [errors, setErrors] = useState<{
    supplierName?: string;
    mobile?: string;
  }>({});

  const { data: supplier, isLoading } = useQuery({
    queryKey: ["supplier", supplierId],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/supplier/getsuppliers?supplierId=${supplierId}`,
      );
      // API returns array; pick the first match
      const list = data.data || [];
      return Array.isArray(list) ? list[0] : list;
    },
    enabled: !!supplierId,
  });

  useEffect(() => {
    if (supplier) {
      setFormData({
        supplierName: supplier.supplierName || "",
        contactPersonName: supplier.contactPersonName || "",
        contactPersonDesignation: supplier.contactPersonDesignation || "",
        mobile: supplier.mobile || "",
        supplierAddress: supplier.supplierAddress || "",
        openingDues:
          supplier.openingDues != null ? String(supplier.openingDues) : "",
        initialDue:
          supplier.initialDue != null ? String(supplier.initialDue) : "",
      });
    }
  }, [supplier]);

  const mutation = useMutation({
    mutationFn: async (payload: typeof formData) =>
      axiosSecure.put(`/supplier/update-supplier/${supplierId}`, {
        ...payload,
        openingDues: undefined,
        initialDue: payload.initialDue ? Number(payload.initialDue) : 0,
      }),
    onSuccess: () => {
      toast.success("Supplier updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier", supplierId] });
      setTimeout(() => navigate("/supplier-list"), 50);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update supplier");
    },
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const BD_MOBILE_REGEX = /^01[3-9]\d{8}$/;

  const handleSubmit = () => {
    const newErrors: typeof errors = {};
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
    mutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Edit Supplier - Baig Ecommerce"
        description="Edit supplier information"
      />
      <PageBreadcrumb pageTitle="Edit Supplier" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Edit Supplier</h2>
              <Link to="/supplier-list">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                  Supplier List
                </Button>
              </Link>
            </div>
          }
        >
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

            {/* Row 2 — Contact Person + Designation + the two due fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="contactPersonName">Contact Person Name</Label>
                <Input
                  id="contactPersonName"
                  type="text"
                  placeholder="Enter Contact Person Name"
                  value={formData.contactPersonName}
                  onChange={(e) =>
                    handleChange("contactPersonName", e.target.value)
                  }
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

              {/* Initial Due — the figure the supplier was carried in with.
                  Editable, and its delta is applied to Total Dues. */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="initialDue">Initial Due</Label>
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-medium select-none">
                    ৳
                  </span>
                  <Input
                    id="initialDue"
                    type="number"
                    placeholder="0.00"
                    value={formData.initialDue}
                    onChange={(e) => handleChange("initialDue", e.target.value)}
                    className="pl-7"
                  />
                </div>
              </div>

              {/* Total Dues — the live running balance, moved by purchases,
                  payments and returns. Read-only; the server drops any value
                  submitted for it. */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="openingDues">Total Dues</Label>
                <div className="relative w-full">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 text-sm font-medium select-none">
                    ৳
                  </span>
                  <Input
                    id="openingDues"
                    type="number"
                    value={formData.openingDues}
                    disabled
                    className="pl-7"
                  />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Updated automatically by purchases, payments and returns.
                </p>
              </div>
            </div>

            {/* Row 3 — Address */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="supplierAddress">Supplier Address</Label>
              <textarea
                id="supplierAddress"
                rows={3}
                placeholder="Enter Supplier Address"
                value={formData.supplierAddress}
                onChange={(e) =>
                  handleChange("supplierAddress", e.target.value)
                }
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSubmit}
                disabled={mutation.isPending}
                  className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-6 py-2 rounded-xl"
              >
                {mutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default SupplierEdit;
