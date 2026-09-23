import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FaChevronDown } from "react-icons/fa";
import axios from "axios";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import { showApiError } from "../../utils/apiError";

interface CustomerType {
  _id: string;
  customerType: string;
  slug: string;
}

export interface CreatedCustomer {
  id: string;
  fullName: string;
  mobileNumber: string;
  emailAddress?: string;
  presentAddress?: string;
  openingDues?: number;
  regularDiscountPercent?: number;
  dueLimit?: number;
  customerType?: { customerType?: string };
}

interface QuickCreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (customer: CreatedCustomer) => void;
  initialName?: string;
  initialMobile?: string;
  /** Customer type pre-selected on open, matched by name (case-insensitive). */
  defaultTypeName?: string;
}

const emptyForm = {
  fullName: "",
  mobileNumber: "",
  emailAddress: "",
  presentAddress: "",
  occupation: "",
  nidNumber: "",
  openingDues: "",
  regularDiscountPercent: "",
  dueLimit: "",
};

const fieldCls =
  "w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
const normalBorder = "border-gray-200 dark:border-gray-700";
const errorBorder = "border-red-400 dark:border-red-500";

const QuickCreateCustomerModal = ({
  isOpen,
  onClose,
  onCreated,
  initialName = "",
  initialMobile = "",
  defaultTypeName,
}: QuickCreateCustomerModalProps) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [selectedType, setSelectedType] = useState<CustomerType | null>(null);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const fetchCustomerTypes = useCallback(async () => {
    try {
      const res = await axiosSecure.get("/customer/get-customertypes");
      const types: CustomerType[] = res?.data?.data?.customerTypes || [];
      setCustomerTypes(types);
      // Pre-select the caller's default if that type exists on this install.
      if (defaultTypeName) {
        const match = types.find(
          (t) => t.customerType.toLowerCase() === defaultTypeName.toLowerCase(),
        );
        if (match) setSelectedType(match);
      }
    } catch (error) {
      showApiError(error, "Failed to load customer types");
    }
  }, [defaultTypeName]);

  // Seed from whatever the cashier already typed on the sale form, so opening
  // the modal never loses their input.
  useEffect(() => {
    if (isOpen) {
      setForm({ ...emptyForm, fullName: initialName, mobileNumber: initialMobile });
      setSelectedType(null);
      setErrors({});
      fetchCustomerTypes();
    }
  }, [isOpen, initialName, initialMobile, fetchCustomerTypes]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!form.mobileNumber.trim()) {
      newErrors.mobileNumber = "Mobile number is required";
    } else if (!/^(01\d{9}|\+8801\d{9})$/.test(form.mobileNumber.trim())) {
      newErrors.mobileNumber = "Must be 01XXXXXXXXX or +8801XXXXXXXXX";
    }
    if (form.nidNumber.trim() && !/^(\d{10}|\d{13}|\d{17})$/.test(form.nidNumber.trim())) {
      newErrors.nidNumber = "NID must be 10, 13, or 17 digits";
    }
    if (!selectedType) newErrors.customerType = "Customer type is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const mobile = form.mobileNumber.trim();
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("fullName", form.fullName.trim());
      formData.append("mobileNumber", mobile);
      formData.append("customerType", selectedType!._id);
      if (form.emailAddress) formData.append("emailAddress", form.emailAddress.trim());
      if (form.presentAddress) formData.append("presentAddress", form.presentAddress.trim());
      if (form.occupation) formData.append("occupation", form.occupation.trim());
      if (form.nidNumber) formData.append("nidNumber", form.nidNumber.trim());
      if (form.openingDues) formData.append("openingDues", form.openingDues);
      if (form.regularDiscountPercent) formData.append("regularDiscountPercent", form.regularDiscountPercent);
      if (form.dueLimit) formData.append("dueLimit", form.dueLimit);

      await axiosSecure.post("/customer/create-customer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // The create endpoint returns only the name, so re-read the list and find
      // the new record by mobile number (unique per customer) to get its id.
      const listRes = await axiosSecure.get("/customer/get-customers");
      const customers: CreatedCustomer[] = listRes?.data?.data?.customers || [];
      const created = customers.find((c) => c.mobileNumber === mobile);

      queryClient.invalidateQueries({ queryKey: ["customers"] });
      // Refresh every dashboard widget (Accounts Balance included) so the
      // change shows without a reload.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      toast.success("Customer created successfully");

      if (!created) {
        toast.error("Customer created, but could not be auto-selected. Pick it from the list.");
        onClose();
        return;
      }

      onCreated(created);
      onClose();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.message
        : undefined;
      toast.error(message || "Failed to create customer");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl p-6">
      <h4 className="text-lg font-bold text-gray-800 dark:text-white/90 mb-5">
        Add New Customer
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
        <div className="flex flex-col gap-1.5">
          <Label>Full Name <span className="text-red-500">*</span></Label>
          <input
            autoFocus
            value={form.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            placeholder="Customer name"
            className={`${fieldCls} ${errors.fullName ? errorBorder : normalBorder}`}
          />
          {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Mobile Number <span className="text-red-500">*</span></Label>
          <input
            value={form.mobileNumber}
            onChange={(e) => handleChange("mobileNumber", e.target.value)}
            placeholder="01XXXXXXXXX"
            className={`${fieldCls} ${errors.mobileNumber ? errorBorder : normalBorder}`}
          />
          {errors.mobileNumber && <p className="text-red-500 text-xs mt-1">{errors.mobileNumber}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Customer Type <span className="text-red-500">*</span></Label>
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setTypeDropdownOpen((p) => !p)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 transition-colors ${errors.customerType ? errorBorder : normalBorder}`}
            >
              <span className={selectedType ? "" : "text-gray-400"}>
                {selectedType ? selectedType.customerType : "Select customer type"}
              </span>
              <FaChevronDown className={`text-xs text-gray-400 transition-transform ${typeDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {typeDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {customerTypes.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400">No customer types found</p>
                ) : (
                  customerTypes.map((t) => (
                    <button
                      key={t._id}
                      type="button"
                      onClick={() => {
                        setSelectedType(t);
                        setTypeDropdownOpen(false);
                        if (errors.customerType) setErrors((p) => ({ ...p, customerType: "" }));
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-brand-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {t.customerType}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {errors.customerType && <p className="text-red-500 text-xs mt-1">{errors.customerType}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Email</Label>
          <input
            value={form.emailAddress}
            onChange={(e) => handleChange("emailAddress", e.target.value)}
            placeholder="youremail@gmail.com"
            className={`${fieldCls} ${normalBorder}`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Address</Label>
          <input
            value={form.presentAddress}
            onChange={(e) => handleChange("presentAddress", e.target.value)}
            placeholder="Present address"
            className={`${fieldCls} ${normalBorder}`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Occupation</Label>
          <input
            value={form.occupation}
            onChange={(e) => handleChange("occupation", e.target.value)}
            placeholder="Occupation"
            className={`${fieldCls} ${normalBorder}`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>NID Number</Label>
          <input
            value={form.nidNumber}
            onChange={(e) => handleChange("nidNumber", e.target.value)}
            placeholder="10, 13 or 17 digits"
            className={`${fieldCls} ${errors.nidNumber ? errorBorder : normalBorder}`}
          />
          {errors.nidNumber && <p className="text-red-500 text-xs mt-1">{errors.nidNumber}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Opening Dues</Label>
          <input
            type="number"
            value={form.openingDues}
            onChange={(e) => handleChange("openingDues", e.target.value)}
            placeholder="0"
            className={`${fieldCls} ${normalBorder}`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Regular Discount (%)</Label>
          <input
            type="number"
            value={form.regularDiscountPercent}
            onChange={(e) => handleChange("regularDiscountPercent", e.target.value)}
            placeholder="0"
            className={`${fieldCls} ${normalBorder}`}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Due Limit</Label>
          <input
            type="number"
            value={form.dueLimit}
            onChange={(e) => handleChange("dueLimit", e.target.value)}
            placeholder="0"
            className={`${fieldCls} ${normalBorder}`}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="outline" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
              Creating...
            </span>
          ) : (
            "Create Customer"
          )}
        </Button>
      </div>
    </Modal>
  );
};

export default QuickCreateCustomerModal;
