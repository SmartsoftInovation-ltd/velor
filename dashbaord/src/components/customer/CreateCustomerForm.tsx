import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { FaPlus, FaTimes, FaSearch, FaTrash, FaChevronDown } from "react-icons/fa";
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

const CreateCustomerForm = () => {
  const queryClient = useQueryClient();

  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [typeSearch, setTypeSearch] = useState("");
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<CustomerType | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showAddTypeModal, setShowAddTypeModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [addingType, setAddingType] = useState(false);

  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    mobileNumber: "",
    occupation: "",
    nidNumber: "",
    openingDues: "",
    regularDiscountPercent: "",
    emailAddress: "",
    presentAddress: "",
    permanentAddress: "",
    remarks: "",
    dueLimit: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const fetchCustomerTypes = useCallback(async () => {
    try {
      const res = await axiosSecure.get("/customer/get-customertypes");
      setCustomerTypes(res?.data?.data?.customerTypes || []);
    } catch (error) {
      showApiError(error, "Failed to load customer types");
    }
  }, []);

  useEffect(() => {
    fetchCustomerTypes();
  }, [fetchCustomerTypes]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setTypeDropdownOpen(false);
        setTypeSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredTypes = customerTypes.filter((t) =>
    t.customerType.toLowerCase().includes(typeSearch.toLowerCase())
  );

  const handleAddType = async () => {
    if (!newTypeName.trim()) {
      toast.error("Name required");
      return;
    }
    setAddingType(true);
    try {
      await axiosSecure.post("/customer/create-customertype", { customerType: newTypeName.trim() });
      toast.success("Customer type created");
      setNewTypeName("");
      setShowAddTypeModal(false);
      await fetchCustomerTypes();
      queryClient.invalidateQueries({ queryKey: ["customer-types"] });
      // Refresh every dashboard widget (Accounts Balance included) so the
      // change shows without a reload.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create type");
    } finally {
      setAddingType(false);
    }
  };

  const handleDeleteType = async (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    try {
      await axiosSecure.delete(`/customer/delete-customertype/${slug}`);
      toast.success("Customer type deleted");
      if (selectedType?.slug === slug) setSelectedType(null);
      await fetchCustomerTypes();
      queryClient.invalidateQueries({ queryKey: ["customer-types"] });
      // Refresh every dashboard widget (Accounts Balance included) so the
      // change shows without a reload.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete type");
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!form.mobileNumber.trim()) newErrors.mobileNumber = "Mobile number is required";
    if (!selectedType) newErrors.customerType = "Customer type is required";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("fullName", form.fullName);
      formData.append("mobileNumber", form.mobileNumber);
      formData.append("customerType", selectedType!._id);
      if (form.occupation) formData.append("occupation", form.occupation);
      if (form.nidNumber) formData.append("nidNumber", form.nidNumber);
      if (form.openingDues) formData.append("openingDues", form.openingDues);
      if (form.regularDiscountPercent) formData.append("regularDiscountPercent", form.regularDiscountPercent);
      if (form.emailAddress) formData.append("emailAddress", form.emailAddress);
      if (form.presentAddress) formData.append("presentAddress", form.presentAddress);
      if (form.permanentAddress) formData.append("permanentAddress", form.permanentAddress);
      if (form.remarks) formData.append("remarks", form.remarks);
      if (form.dueLimit) formData.append("dueLimit", form.dueLimit);
      if (image) formData.append("image", image);

      await axiosSecure.post("/customer/create-customer", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Customer created successfully");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      // Refresh every dashboard widget (Accounts Balance included) so the
      // change shows without a reload.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });

      setForm({
        fullName: "",
        mobileNumber: "",
        occupation: "",
        nidNumber: "",
        openingDues: "",
        regularDiscountPercent: "",
        emailAddress: "",
        presentAddress: "",
        permanentAddress: "",
        remarks: "",
        dueLimit: "",
      });
      setSelectedType(null);
      setImage(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setErrors({});
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create customer");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">

        {/* Customer Type */}
        <div className="flex flex-col gap-1.5">
          <Label>Customer Type <span className="text-red-500">*</span></Label>
          <div ref={dropdownRef} className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setTypeDropdownOpen((p) => !p); setTypeSearch(""); }}
              className={`flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 transition-colors
                ${errors.customerType ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700"}
                ${typeDropdownOpen ? "border-brand-500 ring-2 ring-brand-500/20" : "hover:border-gray-300 dark:hover:border-gray-600"}
                text-gray-800 dark:text-gray-100`}
            >
              <span className={selectedType ? "text-gray-800 dark:text-gray-100" : "text-gray-400"}>
                {selectedType ? selectedType.customerType : "Select customer type"}
              </span>
              <FaChevronDown className={`text-xs text-gray-400 transition-transform duration-200 ${typeDropdownOpen ? "rotate-180" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setShowAddTypeModal(true)}
              className="shrink-0 size-[42px] flex items-center justify-center rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-colors shadow-sm"
              title="Add new customer type"
            >
              <FaPlus className="text-sm" />
            </button>

            {typeDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 right-[50px] z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
                <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="relative">
                    <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search type..."
                      value={typeSearch}
                      onChange={(e) => setTypeSearch(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:outline-none focus:border-brand-400"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredTypes.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No types found</p>
                  ) : (
                    filteredTypes.map((type) => (
                      <div
                        key={type._id}
                        className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/20 group transition-colors
                          ${selectedType?._id === type._id ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600" : "text-gray-700 dark:text-gray-300"}`}
                        onClick={() => {
                          setSelectedType(type);
                          setTypeDropdownOpen(false);
                          setTypeSearch("");
                          if (errors.customerType) setErrors((p) => ({ ...p, customerType: "" }));
                        }}
                      >
                        <span className="text-sm">{type.customerType}</span>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteType(e, type.slug)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                        >
                          <FaTrash className="text-xs" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          {errors.customerType && <p className="text-red-500 text-xs">{errors.customerType}</p>}
        </div>

        {/* Full Name */}
        <div className="flex flex-col gap-1.5">
          <Label>Full Name <span className="text-red-500">*</span></Label>
          <input
            type="text"
            placeholder="Enter full name"
            value={form.fullName}
            onChange={(e) => handleChange("fullName", e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors
              ${errors.fullName ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 focus:border-brand-500"}`}
          />
          {errors.fullName && <p className="text-red-500 text-xs">{errors.fullName}</p>}
        </div>

        {/* Mobile */}
        <div className="flex flex-col gap-1.5">
          <Label>Mobile Number <span className="text-red-500">*</span></Label>
          <input
            type="text"
            placeholder="01XXXXXXXXX"
            value={form.mobileNumber}
            onChange={(e) => handleChange("mobileNumber", e.target.value)}
            className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors
              ${errors.mobileNumber ? "border-red-400 dark:border-red-500" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 focus:border-brand-500"}`}
          />
          {errors.mobileNumber && <p className="text-red-500 text-xs">{errors.mobileNumber}</p>}
        </div>

        {/* Occupation */}
        <div className="flex flex-col gap-1.5">
          <Label>Occupation</Label>
          <input
            type="text"
            placeholder="Enter occupation"
            value={form.occupation}
            onChange={(e) => handleChange("occupation", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* NID */}
        <div className="flex flex-col gap-1.5">
          <Label>NID Number</Label>
          <input
            type="text"
            placeholder="Enter NID number"
            value={form.nidNumber}
            onChange={(e) => handleChange("nidNumber", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Opening Dues */}
        <div className="flex flex-col gap-1.5">
          <Label>Opening Dues (৳)</Label>
          <input
            type="number"
            placeholder="0"
            value={form.openingDues}
            onChange={(e) => handleChange("openingDues", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Due Limit */}
        <div className="flex flex-col gap-1.5">
          <Label>Due Limit (৳)</Label>
          <input
            type="number"
            placeholder="0"
            value={form.dueLimit}
            onChange={(e) => handleChange("dueLimit", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Regular Discount */}
        <div className="flex flex-col gap-1.5">
          <Label>Regular Discount %</Label>
          <input
            type="number"
            placeholder="0"
            value={form.regularDiscountPercent}
            onChange={(e) => handleChange("regularDiscountPercent", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <Label>Email Address</Label>
          <input
            type="email"
            placeholder="example@email.com"
            value={form.emailAddress}
            onChange={(e) => handleChange("emailAddress", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Present Address */}
        <div className="flex flex-col gap-1.5">
          <Label>Present Address</Label>
          <input
            type="text"
            placeholder="Enter present address"
            value={form.presentAddress}
            onChange={(e) => handleChange("presentAddress", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Permanent Address */}
        <div className="flex flex-col gap-1.5">
          <Label>Permanent Address</Label>
          <input
            type="text"
            placeholder="Enter permanent address"
            value={form.permanentAddress}
            onChange={(e) => handleChange("permanentAddress", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Remarks */}
        <div className="flex flex-col gap-1.5">
          <Label>Remarks</Label>
          <input
            type="text"
            placeholder="Enter remarks"
            value={form.remarks}
            onChange={(e) => handleChange("remarks", e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors"
          />
        </div>

        {/* Customer Photo */}
        <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-3">
          <Label>Customer Photo</Label>
          {preview ? (
            <div className="relative inline-block w-32 h-32">
              <img src={preview} alt="Preview" className="w-32 h-32 rounded-2xl object-cover border-2 border-brand-200 dark:border-brand-700" />
              <button
                type="button"
                onClick={removeImage}
                  className="absolute -top-2 -right-2 size-6 flex items-center justify-center rounded-full bg-[#D5F0E3] text-[#0A6B43] hover:bg-[#B8E4CF] shadow-md transition-colors"
              >
                <FaTimes className="text-[10px]" />
              </button>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-colors
                ${isDragActive ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10" : "border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
            >
              <input {...getInputProps()} />
              <div className="size-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDragActive ? "Drop image here..." : "Drag & drop or click to upload"}
              </p>
              <p className="text-xs text-gray-400">PNG, JPG, WEBP up to 5MB</p>
            </div>
          )}
        </div>

      </div>

      {/* Submit */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
            className="bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] px-6 py-2.5 rounded-xl font-semibold"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
              Creating...
            </span>
          ) : (
            "Create Customer"
          )}
        </Button>
      </div>

      {/* Add Customer Type Modal */}
      <Modal
        isOpen={showAddTypeModal}
        onClose={() => { setShowAddTypeModal(false); setNewTypeName(""); }}
        showCloseButton={false}
        className="max-w-sm w-full"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-800 dark:text-white">Add Customer Type</h3>
            <button
              onClick={() => { setShowAddTypeModal(false); setNewTypeName(""); }}
              className="size-8 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
            >
              <FaTimes className="text-xs" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type Name <span className="text-red-500">*</span></Label>
            <input
              type="text"
              placeholder="e.g. Retailer, Wholesale..."
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddType()}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAddType}
              disabled={addingType}
                className="flex-1 bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43]"
            >
              {addingType ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#0A6B43]/30 border-t-[#0A6B43]" />
                  Creating...
                </span>
              ) : (
                "Create"
              )}
            </Button>
            <Button
              onClick={() => { setShowAddTypeModal(false); setNewTypeName(""); }}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default CreateCustomerForm;
