import { ChangeEvent, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router";
import SectionCard from "../../../components/common/SectionCard";
import MobileActionBar from "../../../components/common/MobileActionBar";
import { FaImage, FaShareAlt, FaStore } from "react-icons/fa";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Button from "../../../components/ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { showApiError } from "../../../utils/apiError";

interface SiteInfo {
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
  image: string;
}

const Req = () => <span className="text-red-500 ml-0.5">*</span>;

const SiteInformationUpdate = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof SiteInfo, string>>>({});

  const [formData, setFormData] = useState<SiteInfo>({
    storeName: "", propiterSlogan: "", adress: "", phone: "", secondaryPhone: "",
    email: "", businessHours: "", businessType: "", ownerName: "", websiteLink: "",
    footer: "", facebookLink: "", youtubeLink: "", instagramLink: "", whatsappLink: "",
    twitterLink: "", messengerLink: "", linkedinLink: "", googleMapLink: "", qrCode: "", image: "",
  });

  useEffect(() => {
    const fetchSiteInfo = async () => {
      try {
        const res = await axiosSecure.get(`/siteinformation/single-siteinformation/${slug}`);
        const data = res.data?.data?.site ?? res.data?.data;
        if (data) {
          setFormData({
            storeName: data.storeName || "",
            propiterSlogan: data.propiterSlogan || "",
            adress: data.adress || "",
            phone: data.phone || "",
            secondaryPhone: data.secondaryPhone || "",
            email: data.email || "",
            businessHours: data.businessHours || "",
            businessType: data.businessType || "",
            ownerName: data.ownerName || "",
            websiteLink: data.websiteLink || "",
            footer: data.footer || "",
            facebookLink: data.facebookLink || "",
            youtubeLink: data.youtubeLink || "",
            instagramLink: data.instagramLink || "",
            whatsappLink: data.whatsappLink || "",
            twitterLink: data.twitterLink || "",
            messengerLink: data.messengerLink || "",
            linkedinLink: data.linkedinLink || "",
            googleMapLink: data.googleMapLink || "",
            qrCode: data.qrCode || "",
            image: data.image?.url || data.image || "",
          });
        }
      } catch (error) {
        showApiError(error, "Failed to load site information.");
      } finally {
        setFetching(false);
      }
    };
    fetchSiteInfo();
  }, [slug]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof SiteInfo]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (selectedFile.size > 2 * 1024 * 1024) { toast.error("Image must be under 2MB."); return; }
    setFile(selectedFile);
    setFormData((prev) => ({ ...prev, image: URL.createObjectURL(selectedFile) }));
    setErrors((prev) => ({ ...prev, image: "" }));
  };

  const removeImage = () => {
    setFile(null);
    setFormData((prev) => ({ ...prev, image: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validate = () => {
    const e: Partial<Record<keyof SiteInfo, string>> = {};
    if (!formData.storeName.trim()) e.storeName = "Store name is required.";
    if (!formData.phone.trim()) e.phone = "Phone is required.";
    if (!formData.adress.trim()) e.adress = "Address is required.";
    if (!formData.image && !file) e.image = "Image is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      const form = new FormData();
      const textFields: (keyof SiteInfo)[] = [
        "storeName", "propiterSlogan", "adress", "phone", "secondaryPhone",
        "email", "businessHours", "businessType", "ownerName", "websiteLink",
        "footer", "facebookLink", "youtubeLink", "instagramLink", "whatsappLink",
        "twitterLink", "messengerLink", "linkedinLink", "googleMapLink", "qrCode",
      ];
      textFields.forEach((k) => { if (formData[k]) form.append(k, formData[k]); });
      if (file) form.append("image", file);

      const res = await axiosSecure.put(`/siteinformation/update-siteinformation/${slug}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if ([200, 201, 202].includes(res.status)) {
        toast.success("Site information updated successfully!");
        navigate("/site-info-list");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update site info.");
    } finally {
      setLoading(false);
    }
  };

  const socialFields: [keyof SiteInfo, string][] = [
    ["facebookLink", "Facebook URL"],
    ["youtubeLink", "YouTube URL"],
    ["instagramLink", "Instagram URL"],
    ["whatsappLink", "WhatsApp URL"],
    ["twitterLink", "Twitter / X URL"],
    ["messengerLink", "Messenger URL"],
    ["linkedinLink", "LinkedIn URL"],
    ["googleMapLink", "Google Map URL"],
  ];

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMeta title="Update Site Information | Admin Dashboard" description="Update site information" />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Update Site Information"
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
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard icon={<FaStore />} title="Basic Information">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label>Store Name<Req /></Label>
                  <Input type="text" name="storeName" value={formData.storeName} placeholder="Enter store name" onChange={handleChange} />
                  {errors.storeName && <p className="text-red-500 text-xs mt-1">{errors.storeName}</p>}
                </div>
                <div>
                  <Label>Proprietor Slogan</Label>
                  <Input type="text" name="propiterSlogan" value={formData.propiterSlogan} placeholder="Enter slogan" onChange={handleChange} />
                </div>
                <div>
                  <Label>Owner Name</Label>
                  <Input type="text" name="ownerName" value={formData.ownerName} placeholder="Enter owner name" onChange={handleChange} />
                </div>
                <div>
                  <Label>Business Type</Label>
                  <Input type="text" name="businessType" value={formData.businessType} placeholder="e.g. Retail, Wholesale, E-commerce" onChange={handleChange} />
                </div>
                <div>
                  <Label>Phone<Req /></Label>
                  <Input type="text" name="phone" value={formData.phone} placeholder="Enter phone number" onChange={handleChange} />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
                <div>
                  <Label>Secondary Phone</Label>
                  <Input type="text" name="secondaryPhone" value={formData.secondaryPhone} placeholder="Enter secondary phone number" onChange={handleChange} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" name="email" value={formData.email} placeholder="Enter email address" onChange={handleChange} />
                </div>
                <div>
                  <Label>Website Link</Label>
                  <Input type="text" name="websiteLink" value={formData.websiteLink} placeholder="https://yourwebsite.com" onChange={handleChange} />
                </div>
                <div>
                  <Label>Business Hours</Label>
                  <Input type="text" name="businessHours" value={formData.businessHours} placeholder="e.g. 10:00AM - 08:00PM" onChange={handleChange} />
                </div>
                <div>
                  <Label>QR Code URL</Label>
                  <Input type="text" name="qrCode" value={formData.qrCode} placeholder="Enter QR code URL" onChange={handleChange} />
                </div>
                <div className="md:col-span-2">
                  <Label>Address<Req /></Label>
                  <textarea name="adress" value={formData.adress} onChange={handleChange} rows={3} placeholder="Enter full address"
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-3 focus:ring-accent-500/20 focus:border-accent-500" />
                  {errors.adress && <p className="text-red-500 text-xs mt-1">{errors.adress}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>Footer Text</Label>
                  <textarea name="footer" value={formData.footer} onChange={handleChange} rows={2} placeholder="Enter footer text"
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-3 focus:ring-accent-500/20 focus:border-accent-500" />
                </div>
              </div>
            </SectionCard>
            <SectionCard icon={<FaShareAlt />} title="Social & Contact Links">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {socialFields.map(([field, label]) => (
                  <div key={field}>
                    <Label>{label}</Label>
                    <Input type="text" name={field} value={formData[field]} placeholder={`Enter ${label}`} onChange={handleChange} />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
          <div className="space-y-6">
            <SectionCard icon={<FaImage />} title="Store Logo" className="self-start">
              {!formData.image ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-500/10 transition-colors">
                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Click to upload logo</span>
                  <span className="text-xs text-gray-400 mt-1">JPEG, PNG, WEBP · max 2MB</span>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
                </label>
              ) : (
                <div className="flex items-start gap-4">
                  <div className="w-32 h-32 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                    <img src={formData.image} alt="Preview" className="w-full h-full object-contain p-1" />
                  </div>
                  <div className="flex flex-col gap-2 justify-center">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="shine px-3 py-1.5 text-xs font-medium rounded bg-accent-50 text-accent-600 hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400 transition-colors">
                      Change Image
                    </button>
                    <button type="button" onClick={removeImage}
                      className="shine px-3 py-1.5 text-xs font-medium rounded bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 transition-colors">
                      Remove
                    </button>
                    {file && <span className="text-xs text-gray-400">{file.name}</span>}
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
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
              onClick={handleSubmit}
              disabled={loading}
                className="px-6 py-2.5 !rounded-xl text-sm font-semibold !bg-accent-500 hover:!bg-accent-600 !text-white disabled:opacity-50"
            >
              {loading ? "Updating…" : "Update Site Info"}
            </Button>
            <Link to="/site-info-list">
              <Button className="px-6 py-2.5 !rounded-xl text-sm font-medium !border !border-gray-300 dark:!border-gray-600 !bg-white dark:!bg-gray-800 !text-gray-700 dark:!text-gray-300 hover:!bg-gray-100 dark:hover:!bg-gray-700">
                Cancel
              </Button>
            </Link>
          </div>
        </MobileActionBar>
      </div>
    </>
  );
};

export default SiteInformationUpdate;
