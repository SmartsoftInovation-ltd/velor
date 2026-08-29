import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import axios from "axios";
import toast from "react-hot-toast";
import { FaUpload, FaTimes, FaEye, FaEyeSlash, FaArrowLeft } from "react-icons/fa";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import SearchableSelect from "../../components/form/SearchableSelect";
import Button from "../../components/ui/button/Button";
import axiosSecure from "../../hooks/useAxiosSecure";
import { User } from "../../components/tables/UserTable/UserTable";

interface Role {
  _id: string;
  name: string;
}

interface Errors {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  password?: string;
  discountLimit?: string;
}

const RequiredMark = () => <span className="text-red-500 ml-0.5">*</span>;

const UserEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [isActive, setIsActive] = useState("true");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [discountLimit, setDiscountLimit] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  // Fetch existing user data from list cache
  const { data: user, isLoading: isFetching } = useQuery<User>({
    queryKey: ["user", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/auth/get-user-added-by-admin");
      const list: User[] = data?.data || [];
      const found = list.find((u) => u._id === id);
      if (!found) throw new Error("User not found");
      return found;
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });

  // Populate form when data arrives
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setIsActive(user.isActive ? "true" : "false");
      if (user.roles && user.roles.length > 0) setRole(user.roles[0]._id);
      if (user.image?.url) setExistingImageUrl(user.image.url);
      setDiscountLimit(user.discountLimit !== undefined ? String(user.discountLimit) : "");
    }
  }, [user]);

  // Fetch roles list
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
      setExistingImageUrl(null);
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
    setExistingImageUrl(null);
  };

  const validate = (): boolean => {
    const newErrors: Errors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Invalid email format";
    }
    if (!phone.trim()) newErrors.phone = "Phone is required";
    if (!role) newErrors.role = "Role is required";
    if (password && password.length < 6) newErrors.password = "Password must be at least 6 characters";
    if (discountLimit !== "") {
      const v = Number(discountLimit);
      if (isNaN(v) || v < 0 || v > 100) newErrors.discountLimit = "Discount limit must be between 0 and 100.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Please fix the errors below");
      return;
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("name", name);
    formData.append("email", email);
    formData.append("phone", phone);
    formData.append("role", role);
    formData.append("isActive", isActive);
    if (password) formData.append("password", password);
    if (discountLimit !== "") formData.append("discountLimit", discountLimit);
    if (image) formData.append("image", image);

    try {
      await axiosSecure.put(`/auth/user-update/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("User updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", id] });
      setTimeout(() => navigate("/userlist"), 50);
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to update user");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions = roles.map((r) => ({ value: r._id, label: r.name }));
  const statusOptions = [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" },
  ];

  if (isFetching) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`Edit User - ${name}`} description="Edit user details" />
      <PageBreadcrumb pageTitle="Edit User" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Edit User</h2>
              <button
                onClick={() => navigate("/userlist")}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-500 transition-colors font-medium"
              >
                <FaArrowLeft className="size-3.5" />
                Back to Users
              </button>
            </div>
          }
        >
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-theme-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div>
                <Label htmlFor="name">Full Name <RequiredMark /></Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
                  className={errors.name ? "border-red-500 focus:border-red-500" : ""}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="email">Email <RequiredMark /></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  className={errors.email ? "border-red-500 focus:border-red-500" : ""}
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>

              {/* Phone */}
              <div>
                <Label htmlFor="phone">Phone <RequiredMark /></Label>
                <Input
                  id="phone"
                  type="text"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setErrors((p) => ({ ...p, phone: undefined })); }}
                  className={errors.phone ? "border-red-500 focus:border-red-500" : ""}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>

              {/* Password (optional on edit) */}
              <div>
                <Label htmlFor="edit-password">
                  New Password{" "}
                  <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(leave blank to keep current)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
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
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>

              {/* Role */}
              <div>
                <Label>Role <RequiredMark /></Label>
                <SearchableSelect
                  options={roleOptions}
                  value={role}
                  onChange={(val) => { setRole(val); setErrors((p) => ({ ...p, role: undefined })); }}
                  placeholder="Select a role"
                  searchPlaceholder="Search roles..."
                  hasError={!!errors.role}
                />
                {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
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
              <div>
                <Label htmlFor="edit-discountLimit">
                  Discount Limit{" "}
                  <span className="text-gray-400 dark:text-gray-500 font-normal text-xs">(0 – 100%)</span>
                </Label>
                <div className="relative">
                  <Input
                    id="edit-discountLimit"
                    type="number"
                    placeholder="e.g. 10"
                    value={discountLimit}
                    onChange={(e) => { setDiscountLimit(e.target.value); setErrors((p) => ({ ...p, discountLimit: undefined })); }}
                    className={`pr-10 ${errors.discountLimit ? "border-red-500 focus:border-red-500" : ""}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400 pointer-events-none">
                    %
                  </span>
                </div>
                {errors.discountLimit && <p className="text-red-500 text-xs mt-1">{errors.discountLimit}</p>}
              </div>
            </div>

            {/* Image upload */}
            <div className="mt-6">
              <Label>Profile Image</Label>

              {preview || existingImageUrl ? (
                <div className="mt-2 relative inline-block group">
                  <img
                    src={preview || existingImageUrl || ""}
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
                  {image && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate max-w-32">
                      {image.name}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={`mt-2 flex flex-col items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
                    isDragActive
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                      : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/5"
                  }`}
                >
                  <input {...getInputProps()} />
                  <FaUpload className="size-7 mb-3 text-gray-400 dark:text-gray-500" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                    {isDragActive ? "Drop the image here" : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG, WEBP up to 5MB</p>
                </div>
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
                    <span>Saving...</span>
                  </div>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default UserEdit;
