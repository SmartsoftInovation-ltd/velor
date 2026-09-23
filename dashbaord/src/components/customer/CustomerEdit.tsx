import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { FaPlus, FaTimes, FaSearch, FaTrash, FaChevronDown, FaArrowLeft } from "react-icons/fa";
import axios from "axios";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import Loader from "../common/Loader";
import { showApiError } from "../../utils/apiError";

interface CustomerType {
  _id: string;
  customerType: string;
  slug: string;
}

const CustomerEdit = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
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
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: "",
    mobileNumber: "",
    occupation: "",
    nidNumber: "",
    openingDues: "",
    initialDue: "",
    regularDiscountPercent: "",
    emailAddress: "",
    presentAddress: "",
    permanentAddress: "",
    remarks: "",
    dueLimit: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Fetch existing customer data
  const { data: customerData, isLoading: isFetching, isError } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/customer/get-customers?customerId=${customerId}`);
      const list = data?.data?.customers || [];
      return list[0] || null;
    },
    enabled: !!customerId,
  });

  // Populate form when data arrives
  useEffect(() => {
    if (!customerData) return;
    setForm({
      fullName: customerData.fullName || "",
      mobileNumber: customerData.mobileNumber || "",
      occupation: customerData.occupation || "",
      nidNumber: customerData.nidNumber || "",
      openingDues: customerData.openingDues?.toString() || "",
      initialDue: customerData.initialDue?.toString() || "",
      regularDiscountPercent: customerData.regularDiscountPercent?.toString() || "",
      emailAddress: customerData.emailAddress || "",
      presentAddress: customerData.presentAddress || "",
      permanentAddress: customerData.permanentAddress || "",
      remarks: customerData.remarks || "",
      dueLimit: customerData.dueLimit?.toString() || "",
    });
    if (customerData.customerType) setSelectedType(customerData.customerType);
    if (customerData.image?.url) setExistingImageUrl(customerData.image.url);
  }, [customerData]);

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
    if (!newTypeName.trim()) { toast.error("Name required"); return; }
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
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to delete type");
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setImage(file);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(file));
      setExistingImageUrl(null);
    }
  }, [preview]);

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
    setExistingImageUrl(null);
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
      if (form.initialDue) formData.append("initialDue", form.initialDue);
      if (form.regularDiscountPercent) formData.append("regularDiscountPercent", form.regularDiscountPercent);
      if (form.emailAddress) formData.append("emailAddress", form.emailAddress);
      if (form.presentAddress) formData.append("presentAddress", form.presentAddress);
      if (form.permanentAddress) formData.append("permanentAddress", form.permanentAddress);
      if (form.remarks) formData.append("remarks", form.remarks);
      if (form.dueLimit) formData.append("dueLimit", form.dueLimit);
      if (image) formData.append("image", image);

      await axiosSecure.put(`/customer/update-customer/${customerId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Customer updated successfully");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      // Refresh every dashboard widget (Accounts Balance included) so the
      // change shows without a reload.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      setTimeout(() => navigate("/customer-list"), 50);
    } catch (err: any) {
      if (axios.isAxiosError(err)) {
        toast.error(err.response?.data?.message || "Failed to update customer");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const displayImage = preview || existingImageUrl;

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <Loader />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <p className="text-red-500 font-bold text-lg">Customer not found.</p>
        <button onClick={() => navigate("/customer-list")} className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl font-semibold">
          Back to List
        </button>
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`Edit ${form.fullName || "Customer"} - Baig Ecommerce`} description="Edit customer details" />
      <PageBreadcrumb pageTitle="Edit Customer" />
      <div className="space-y-6 mt-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-md font-medium">Edit Customer</h2>
              <button
                onClick={() => navigate("/customer-list")}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm font-semibold transition-colors"
              >
                <FaArrowLeft className="size-3.5" />
                Back to List
              </button>
            </div>
          }
        >
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
                <input type="text" placeholder="Enter occupation" value={form.occupation}
                  onChange={(e) => handleChange("occupation", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* NID */}
              <div className="flex flex-col gap-1.5">
                <Label>NID Number</Label>
                <input type="text" placeholder="Enter NID number" value={form.nidNumber}
                  onChange={(e) => handleChange("nidNumber", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* Initial Due — the figure the customer was carried in with.
                  Editable so a wrong starting balance can be corrected. */}
              <div className="flex flex-col gap-1.5">
                <Label>Initial Due (৳)</Label>
                <input type="number" placeholder="0" value={form.initialDue}
                  onChange={(e) => handleChange("initialDue", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* Opening Dues — the live running balance, moved by sales,
                  payments and returns. Read-only: the server drops any value
                  submitted for it. */}
              <div className="flex flex-col gap-1.5">
                <Label>Total Dues (৳)</Label>
                <input type="number" value={form.openingDues} disabled readOnly
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed focus:outline-none" />
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Updated automatically by sales, payments and returns.
                </p>
              </div>

              {/* Due Limit */}
              <div className="flex flex-col gap-1.5">
                <Label>Due Limit (৳)</Label>
                <input type="number" placeholder="0" value={form.dueLimit}
                  onChange={(e) => handleChange("dueLimit", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* Regular Discount */}
              <div className="flex flex-col gap-1.5">
                <Label>Regular Discount %</Label>
                <input type="number" placeholder="0" value={form.regularDiscountPercent}
                  onChange={(e) => handleChange("regularDiscountPercent", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <Label>Email Address</Label>
                <input type="email" placeholder="example@email.com" value={form.emailAddress}
                  onChange={(e) => handleChange("emailAddress", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* Present Address */}
              <div className="flex flex-col gap-1.5">
                <Label>Present Address</Label>
                <input type="text" placeholder="Enter present address" value={form.presentAddress}
                  onChange={(e) => handleChange("presentAddress", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* Permanent Address */}
              <div className="flex flex-col gap-1.5">
                <Label>Permanent Address</Label>
                <input type="text" placeholder="Enter permanent address" value={form.permanentAddress}
                  onChange={(e) => handleChange("permanentAddress", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* Remarks */}
              <div className="flex flex-col gap-1.5">
                <Label>Remarks</Label>
                <input type="text" placeholder="Enter remarks" value={form.remarks}
                  onChange={(e) => handleChange("remarks", e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 hover:border-gray-300 transition-colors" />
              </div>

              {/* Customer Photo */}
              <div className="flex flex-col gap-1.5 md:col-span-2 lg:col-span-3">
                <Label>Customer Photo</Label>
                {displayImage ? (
                  <div className="relative inline-block w-32 h-32">
                    <img src={displayImage} alt="Preview" className="w-32 h-32 rounded-2xl object-cover border-2 border-brand-200 dark:border-brand-700" />
                    <button
                      type="button"
                      onClick={removeImage}
                        className="absolute -top-2 -right-2 size-6 flex items-center justify-center rounded-full bg-[#DCE8FF] text-[#1D4ED8] hover:bg-[#C7DAFF] shadow-md transition-colors"
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
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => navigate("/customer-list")}
                className="px-5 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                  className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-6 py-2.5 rounded-xl font-semibold"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                    Saving...
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </ComponentCard>
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
            <Button onClick={handleAddType} disabled={addingType} className="flex-1 bg-brand-500 hover:bg-brand-600 text-white">
              {addingType ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
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
    </>
  );
};

export default CustomerEdit;
