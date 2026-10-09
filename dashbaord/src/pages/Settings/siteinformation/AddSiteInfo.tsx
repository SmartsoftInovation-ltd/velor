import { ChangeEvent, FormEvent, useRef, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router";
import SectionCard from "../../../components/common/SectionCard";
import MobileActionBar from "../../../components/common/MobileActionBar";
import { FaImage, FaShareAlt, FaStore } from "react-icons/fa";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Button from "../../../components/ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { useFormDraft, draftValue, clearDraft } from "../../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "add-site-info";

interface SiteFormData {
  storeName: string;
  propiterSlogan: string;
  adress: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  businessHours: string;
  businessType: string;
  ownerName: string;
  websiteLink: string;
  footer: string;
  facebookLink: string;
  youtubeLink: string;
  instagramLink: string;
  whatsappLink: string;
  twitterLink: string;
  messengerLink: string;
  linkedinLink: string;
  googleMapLink: string;
  qrCode: string;
}

const initialForm: SiteFormData = {
  storeName: "",
  propiterSlogan: "",
  adress: "",
  phone: "",
  secondaryPhone: "",
  email: "",
  businessHours: "",
  businessType: "",
  ownerName: "",
  websiteLink: "",
  footer: "",
  facebookLink: "",
  youtubeLink: "",
  instagramLink: "",
  whatsappLink: "",
  twitterLink: "",
  messengerLink: "",
  linkedinLink: "",
  googleMapLink: "",
  qrCode: "",
};

const Req = () => <span className="text-red-500 ml-0.5">*</span>;

const AddSiteInfo = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<SiteFormData>(() => draftValue<SiteFormData>(DRAFT_KEY, "formData", initialForm));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ formData }), [formData]),
  );
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof SiteFormData | "image", string>>>({});

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof SiteFormData]) setErrors((prev) => ({ ...prev, [name]: "" }));
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
    if (!formData.storeName.trim()) e.storeName = "Store name is required.";
    if (!formData.adress.trim()) e.adress = "Address is required.";
    if (!formData.phone.trim()) e.phone = "Phone is required.";
    if (!image) e.image = "Store logo is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      setLoading(true);
      const data = new FormData();
      (Object.keys(formData) as (keyof SiteFormData)[]).forEach((k) => {
        if (formData[k]) data.append(k, formData[k]);
      });
      data.append("image", image!);
      const res = await axiosSecure.post("/siteinformation/create-siteinformation", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if ([200, 201].includes(res.status)) {
        toast.success("Site information created successfully!");
        clearDraft(DRAFT_KEY);
        navigate("/site-info-list");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to create site information.");
    } finally {
      setLoading(false);
    }
  };

  const socialFields: [keyof SiteFormData, string][] = [
    ["facebookLink", "Facebook URL"],
    ["youtubeLink", "YouTube URL"],
    ["instagramLink", "Instagram URL"],
    ["whatsappLink", "WhatsApp URL"],
    ["twitterLink", "Twitter / X URL"],
    ["messengerLink", "Messenger URL"],
    ["linkedinLink", "LinkedIn URL"],
    ["googleMapLink", "Google Map URL"],
  ];

  return (
    <>
      <PageMeta title="Add Site Information | Admin Dashboard" description="Create site information" />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Site Information"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/site-info-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Site Info List
            </Button>
          </Link>
        }
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard icon={<FaStore />} title="Basic Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label>Store Name<Req /></Label>
                  <Input type="text" name="storeName" placeholder="Enter store name" value={formData.storeName} onChange={handleChange} />
                  {errors.storeName && <p className="text-red-500 text-xs mt-1">{errors.storeName}</p>}
                </div>
                <div>
                  <Label>Proprietor Slogan</Label>
                  <Input type="text" name="propiterSlogan" placeholder="Enter slogan" value={formData.propiterSlogan} onChange={handleChange} />
                </div>
                <div>
                  <Label>Owner Name</Label>
                  <Input type="text" name="ownerName" placeholder="Enter owner name" value={formData.ownerName} onChange={handleChange} />
                </div>
                <div>
                  <Label>Business Type</Label>
                  <Input type="text" name="businessType" placeholder="e.g. Retail, Wholesale, E-commerce" value={formData.businessType} onChange={handleChange} />
                </div>
                <div>
                  <Label>Phone<Req /></Label>
                  <Input type="text" name="phone" placeholder="Enter phone number" value={formData.phone} onChange={handleChange} />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <Label>Secondary Phone</Label>
                  <Input type="text" name="secondaryPhone" placeholder="Enter secondary phone number" value={formData.secondaryPhone} onChange={handleChange} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" name="email" placeholder="Enter email address" value={formData.email} onChange={handleChange} />
                </div>
                <div>
                  <Label>Website Link</Label>
                  <Input type="text" name="websiteLink" placeholder="https://yourwebsite.com" value={formData.websiteLink} onChange={handleChange} />
                </div>
                <div>
                  <Label>Business Hours</Label>
                  <Input type="text" name="businessHours" placeholder="e.g. 10:00AM - 08:00PM" value={formData.businessHours} onChange={handleChange} />
                </div>
                <div>
                  <Label>QR Code URL</Label>
                  <Input type="text" name="qrCode" placeholder="Enter QR code URL" value={formData.qrCode} onChange={handleChange} />
                </div>
                <div className="md:col-span-2">
                  <Label><span>Address</span><Req /></Label>
                  <textarea name="adress" placeholder="Enter full address" value={formData.adress} onChange={handleChange} rows={3}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-3 focus:ring-accent-500/20 focus:border-accent-500 text-sm" />
                  {errors.adress && <p className="text-red-500 text-xs mt-1">{errors.adress}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>Footer Text</Label>
                  <textarea name="footer" placeholder="Enter footer text" value={formData.footer} onChange={handleChange} rows={2}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-3 focus:ring-accent-500/20 focus:border-accent-500 text-sm" />
                </div>
              </div>
            </SectionCard>
            <SectionCard icon={<FaShareAlt />} title="Social & Contact Links">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {socialFields.map(([field, label]) => (
                  <div key={field}>
                    <Label>{label}</Label>
                    <Input type="text" name={field} placeholder={`Enter ${label}`} value={formData[field]} onChange={handleChange} />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
          <div className="space-y-6">
            <SectionCard icon={<FaImage />} title="Store Logo" className="self-start">
              {!imagePreview ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-colors">
                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload logo</span>
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
              {loading ? "Creating..." : "Create Site Info"}
            </Button>
            <Link to="/site-info-list">
              <button type="button" className="shine px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                Cancel
              </button>
            </Link>
          </div>
        </MobileActionBar>
      </form>
    </>
  );
};

export default AddSiteInfo;
