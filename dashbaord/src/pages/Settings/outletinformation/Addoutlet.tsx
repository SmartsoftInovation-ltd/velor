import { ChangeEvent, FormEvent, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import SectionCard from "../../../components/common/SectionCard";
import MobileActionBar from "../../../components/common/MobileActionBar";
import { FaImage, FaMapMarkerAlt } from "react-icons/fa";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Button from "../../../components/ui/button/Button";
import SearchableSelect from "../../../components/form/SearchableSelect";
import axiosSecure from "../../../hooks/useAxiosSecure";

interface OutletFormData {
  locationName: string;
  address: string;
  managerName: string;
  managerMobile: string;
  email: string;
  businessHour: string;
  offDay: string;
}

const initialForm: OutletFormData = {
  locationName: "",
  address: "",
  managerName: "",
  managerMobile: "",
  email: "",
  businessHour: "",
  offDay: "",
};

const Req = () => <span className="text-red-500 ml-0.5">*</span>;

const WEEK_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const AddOutletInfo = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<OutletFormData>(initialForm);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof OutletFormData | "image", string>>>({});

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof OutletFormData]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB."); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) { toast.error("Only JPEG, PNG or WEBP allowed."); return; }
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, image: "" }));
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!formData.locationName.trim()) e.locationName = "Location name is required.";
    if (!formData.address.trim()) e.address = "Address is required.";
    if (!formData.managerName.trim()) e.managerName = "Manager name is required.";
    if (!formData.managerMobile.trim()) e.managerMobile = "Manager mobile is required.";
    if (!formData.email.trim()) e.email = "Email is required.";
    if (!formData.businessHour.trim()) e.businessHour = "Business hour is required.";
    if (!formData.offDay.trim()) e.offDay = "Off day is required.";
    if (!image) e.image = "Outlet image is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setLoading(true);
      const data = new FormData();
      (Object.keys(formData) as (keyof OutletFormData)[]).forEach((k) => {
        data.append(k, formData[k]);
      });
      data.append("image", image!);
      const res = await axiosSecure.post("/outletinformation/create-outletinformation", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if ([200, 201].includes(res.status)) {
        toast.success("Outlet information created successfully!");
        navigate("/outlet-list");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create outlet information.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageMeta title="Add Outlet Information | Admin Dashboard" description="Create outlet information" />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Outlet Information"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/outlet-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Outlet List
            </Button>
          </Link>
        }
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard icon={<FaMapMarkerAlt />} title="Outlet Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label>Location Name<Req /></Label>
                  <Input type="text" name="locationName" placeholder="Enter outlet location name" value={formData.locationName} onChange={handleChange} />
                  {errors.locationName && <p className="text-red-500 text-xs mt-1">{errors.locationName}</p>}
                </div>
                <div>
                  <Label>Manager Name<Req /></Label>
                  <Input type="text" name="managerName" placeholder="Enter manager name" value={formData.managerName} onChange={handleChange} />
                  {errors.managerName && <p className="text-red-500 text-xs mt-1">{errors.managerName}</p>}
                </div>
                <div>
                  <Label>Manager Mobile<Req /></Label>
                  <Input type="text" name="managerMobile" placeholder="Enter manager mobile" value={formData.managerMobile} onChange={handleChange} />
                  {errors.managerMobile && <p className="text-red-500 text-xs mt-1">{errors.managerMobile}</p>}
                </div>
                <div>
                  <Label>Email<Req /></Label>
                  <Input type="email" name="email" placeholder="Enter manager email" value={formData.email} onChange={handleChange} />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <Label>Business Hour<Req /></Label>
                  <Input type="text" name="businessHour" placeholder="e.g. 10:00AM - 08:00PM" value={formData.businessHour} onChange={handleChange} />
                  {errors.businessHour && <p className="text-red-500 text-xs mt-1">{errors.businessHour}</p>}
                </div>
                <div>
                  <Label>Weekly Off Day<Req /></Label>
                  <SearchableSelect
                    options={[
                      ...WEEK_DAYS,
                      // Keep an older free-text value selectable.
                      ...(formData.offDay && !WEEK_DAYS.includes(formData.offDay) ? [formData.offDay] : []),
                    ].map((d) => ({ value: d, label: d }))}
                    value={formData.offDay}
                    onChange={(v) => { setFormData((prev) => ({ ...prev, offDay: v })); setErrors((prev) => ({ ...prev, offDay: "" })); }}
                    hasError={!!errors.offDay}
                    placeholder="Select off day"
                    searchPlaceholder="Search day..."
                  />
                  {errors.offDay && <p className="text-red-500 text-xs mt-1">{errors.offDay}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>Address<Req /></Label>
                  <textarea name="address" placeholder="Enter outlet address" value={formData.address} onChange={handleChange} rows={3}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-3 focus:ring-accent-500/20 focus:border-accent-500 text-sm" />
                  {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                </div>
              </div>
            </SectionCard>
          </div>
          <div className="space-y-6">
            <SectionCard icon={<FaImage />} title="Outlet Image" className="self-start">
              {!imagePreview ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-colors">
                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload image</span>
                  <span className="text-xs text-gray-400 mt-1">JPEG, PNG, WEBP · max 2MB</span>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
                </label>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="w-32 h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-contain p-1" />
                  </div>
                  <div className="flex flex-col gap-2 justify-center h-32">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="shine px-3 py-1.5 text-xs font-medium rounded bg-accent-50 text-accent-600 hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400 transition-colors">
                      Change Image
                    </button>
                    <button type="button" onClick={removeImage}
                      className="shine px-3 py-1.5 text-xs font-medium rounded bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 transition-colors">
                      Remove
                    </button>
                    <span className="text-xs text-gray-400 truncate max-w-[140px]">{image?.name}</span>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
                  </div>
                </div>
              )}
              {errors.image && <p className="text-red-500 text-xs mt-2">{errors.image}</p>}
            </SectionCard>
          </div>
        </div>

        <MobileActionBar>
          <div className="flex flex-row-reverse sm:flex-row justify-end gap-3 pt-2">
            <Button
              // @ts-ignore
              type="submit" disabled={loading}
              className="px-6 py-2.5 !rounded-xl text-sm font-semibold !bg-accent-500 hover:!bg-accent-600 !text-white disabled:opacity-50">
              {loading ? "Creating…" : "Create Outlet Info"}
            </Button>
            <Link to="/outlet-list">
              <button
                type="button"
                  className="shine px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </Link>
          </div>
        </MobileActionBar>
      </form>
    </>
  );
};

export default AddOutletInfo;
