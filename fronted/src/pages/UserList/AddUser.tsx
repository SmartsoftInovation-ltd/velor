import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import ComponentCard from "../../components/common/ComponentCard";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import SearchableSelect from "../../components/form/SearchableSelect";
import Button from "../../components/ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import axios from "axios";
import { FaUpload, FaTimes, FaEye, FaEyeSlash, FaPlus } from "react-icons/fa";

interface Role {
  _id: string;
  name: string;
}

interface Errors {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  role?: string;
  image?: string;
  discountLimit?: string;
}

const RequiredMark = () => (
  <span className="text-red-500 ml-0.5">*</span>
);

const AddUser = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleError, setNewRoleError] = useState("");
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [discountLimit, setDiscountLimit] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    axiosSecure
      .get("/all-role")
      .then((res) => setRoles(res.data?.data || []))
      .catch(() => toast.error("Failed to fetch roles"));
  }, []);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      toast.error("File too large or unsupported format (max 5MB)");
      return;
    }
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setErrors((prev) => ({ ...prev, image: undefined }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".png", ".jpg", ".webp", ".svg"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  const handleRemoveImage = () => {
    setImage(null);
    setPreview(null);
  };

  const validate = (): boolean => {
    const newErrors: Errors = {};
    if (!name.trim()) newErrors.name = "User name is required";
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Invalid email format";
    }
    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (!phone.trim()) newErrors.phone = "Phone number is required";
    if (!role) newErrors.role = "Role is required";
    if (!image) newErrors.image = "User image is required";
    if (discountLimit !== "") {
      const v = Number(discountLimit);
      if (isNaN(v) || v < 0 || v > 100) newErrors.discountLimit = "Discount limit must be between 0 and 100.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Please fill all required fields");
      return;
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("password", password);
    formData.append("phone", phone);
    formData.append("role", role);
    formData.append("isActive", isActive);
    if (discountLimit !== "") formData.append("discountLimit", discountLimit);
    if (image) formData.append("image", image);

    try {
      await axiosSecure.post("/auth/add-user", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("User added successfully!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setRole("");
      setIsActive("true");
      setImage(null);
      setPreview(null);
      setDiscountLimit("");
      setErrors({});
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to add user");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      setNewRoleError("Role name is required.");
      return;
    }
    setIsCreatingRole(true);
    try {
      const { data } = await axiosSecure.post("/create-role", { name: newRoleName.trim() });
      const created = data?.data;
      if (!created?._id) throw new Error("Invalid response");
      toast.success("Role created successfully!");
      setRoles((prev) => [...prev, { _id: created._id, name: created.name }]);
      setRole(created._id);
      setErrors((prev) => ({ ...prev, role: undefined }));
      setNewRoleName("");
      setNewRoleError("");
      setShowRoleModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create role.");
    } finally {
      setIsCreatingRole(false);
    }
  };

  const roleOptions = roles.map((r) => ({ value: r._id, label: r.name }));
  const statusOptions = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ];

  return (
    <>
      <PageMeta
        title="Add User - Baig Ecommerce"
        description="Add a new user to the admin dashboard"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Add New User"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/userlist">
            <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
              User List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-theme-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <Label htmlFor="name">
                  User Name <RequiredMark />
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter user name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  className={errors.name ? "border-red-500 focus:border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">
                  Email <RequiredMark />
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  className={errors.email ? "border-red-500 focus:border-red-500" : ""}
                />
                {errors.email && (
                  <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <Label htmlFor="password">
                  Password <RequiredMark />
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    className={`pr-11 ${errors.password ? "border-red-500 focus:border-red-500" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <FaEyeSlash className="size-4" /> : <FaEye className="size-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-xs mt-1">{errors.password}</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone">
                  Phone <RequiredMark />
                </Label>
                <Input
                  id="phone"
                  type="text"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  className={errors.phone ? "border-red-500 focus:border-red-500" : ""}
                />
                {errors.phone && (
                  <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                )}
              </div>

              {/* Role */}
              <div>
                <Label>
                  Role <RequiredMark />
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      options={roleOptions}
                      value={role}
                      onChange={(val) => {
                        setRole(val);
                        setErrors((prev) => ({ ...prev, role: undefined }));
                      }}
                      placeholder="Select a role"
                      searchPlaceholder="Search roles..."
                      hasError={!!errors.role}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowRoleModal(true); setNewRoleName(""); setNewRoleError(""); }}
                    title="Create new role"
                    className="size-[42px] shrink-0 flex items-center justify-center rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-sm shadow-brand-500/30 transition-all active:scale-95"
                  >
                    <FaPlus className="size-4" />
                  </button>
                </div>
                {errors.role && (
                  <p className="text-red-500 text-xs mt-1">{errors.role}</p>
                )}
              </div>

              {/* Status */}
              <div>
                <Label>Status</Label>
                <SearchableSelect
                  options={statusOptions}
                  value={isActive}
                  onChange={setIsActive}
                  placeholder="Select status"
                />
              </div>

              {/* Discount Limit */}
              <div className="md:col-span-2">
                <Label htmlFor="discountLimit">
                  Discount Limit{" "}
                  <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(0 – 100%)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="discountLimit"
                    type="number"
                    placeholder="e.g. 10"
                    value={discountLimit}
                    onChange={(e) => {
                      setDiscountLimit(e.target.value);
                      setErrors((prev) => ({ ...prev, discountLimit: undefined }));
                    }}
                    className={`pr-10 ${errors.discountLimit ? "border-red-500 focus:border-red-500" : ""}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">
                    %
                  </span>
                </div>
                {errors.discountLimit && (
                  <p className="text-red-500 text-xs mt-1">{errors.discountLimit}</p>
                )}
              </div>
            </div>

            {/* Image Upload — full width */}
            <div className="mt-6">
              <Label>
                User Image <RequiredMark />
              </Label>

              {preview ? (
                <div className="mt-2 relative inline-block group">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-md"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 size-6 flex items-center justify-center rounded-full bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] shadow-md transition-colors"
                  >
                    <FaTimes className="size-3" />
                  </button>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate max-w-[128px]">
                    {image?.name}
                  </p>
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`mt-2 flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                    isDragActive
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                      : errors.image
                      ? "border-red-400 bg-red-50 dark:bg-red-500/5"
                      : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/5"
                  }`}
                >
                  <input {...getInputProps()} />
                  <FaUpload
                    className={`size-7 mb-3 ${
                      errors.image ? "text-red-400" : "text-gray-400 dark:text-gray-500"
                    }`}
                  />
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    {isDragActive ? "Drop the image here" : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    PNG, JPG, WEBP up to 5MB
                  </p>
                </div>
              )}
              {errors.image && (
                <p className="text-red-500 text-xs mt-1">{errors.image}</p>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-6 mt-2 border-t border-gray-100 dark:border-gray-800">
              <Button
                onClick={handleSubmit}
                disabled={isLoading}
                  className="px-8 py-2.5 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  "Add User"
                )}
              </Button>
            </div>
          </div>
        </ComponentCard>
      </div>

      {/* Quick-create Role modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowRoleModal(false)} />
          <div
            className="relative w-full max-w-sm mx-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold text-gray-800 dark:text-white">Create New Role</h3>
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="size-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <FaTimes className="size-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <Label htmlFor="quick-role-name">
                Role Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="quick-role-name"
                type="text"
                placeholder="e.g. Manager, Editor..."
                value={newRoleName}
                className={newRoleError ? "border-red-500" : ""}
                onChange={(e) => { setNewRoleName(e.target.value); setNewRoleError(""); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateRole();
                  if (e.key === "Escape") setShowRoleModal(false);
                }}
              />
              {newRoleError && <p className="text-red-500 text-xs mt-1">{newRoleError}</p>}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 pb-5">
              <button
                type="button"
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <Button
                onClick={handleCreateRole}
                disabled={isCreatingRole}
                  className="px-5 py-2 rounded-xl bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] text-sm font-semibold border-none disabled:opacity-50 transition-colors"
              >
                {isCreatingRole ? (
                  <div className="flex items-center gap-2">
                    <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating...</span>
                  </div>
                ) : "Create Role"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AddUser;
