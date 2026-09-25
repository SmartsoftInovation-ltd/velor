import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FaBullhorn, FaLink, FaImage } from "react-icons/fa";
import SectionCard from "../../../components/common/SectionCard";
import MobileActionBar from "../../../components/common/MobileActionBar";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import PageMeta from "../../../components/common/PageMeta";
import Label from "../../../components/form/Label";
import Input from "../../../components/form/input/InputField";
import Button from "../../../components/ui/button/Button";
import { TrashBinIcon } from "../../../icons";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { Link } from "react-router";
import { showApiError } from "../../../utils/apiError";

interface BannerForm {
  title: string;
  headLine: string;
  description: string;
  link: string;
  priority: string;
}

const Req = () => <span className="text-red-500 ml-0.5">*</span>;

const BannerUpdate = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<BannerForm>({
    title: "",
    headLine: "",
    description: "",
    link: "",
    priority: "",
  });
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof BannerForm | "image", string>>>({});

  // Fetch existing banner data
  useEffect(() => {
    const fetchBanner = async () => {
      try {
        const res = await axiosSecure.get(`/banner/single-banner/${slug}`);
        const data = res.data?.data?.banner ?? res.data?.data;
        if (data) {
          setFormData({
            title: data.title || "",
            headLine: data.headLine || "",
            description: data.description || "",
            link: data.link || "",
            priority: data.priority?.toString() || "",
          });
          const imgUrl = typeof data.image === "object" ? data.image?.url : data.image;
          if (imgUrl) setPreview(imgUrl);
        }
      } catch (error) {
        showApiError(error, "Failed to load banner details.");
      } finally {
        setIsFetching(false);
      }
    };
    if (slug) fetchBanner();
  }, [slug]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof BannerForm]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  // ---------- Dropzone ----------
  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length > 0) {
      const code = rejected[0].errors[0].code;
      if (code === "file-too-large") toast.error("Max file size is 5MB.");
      else if (code === "file-invalid-type") toast.error("Images only.");
      else toast.error(rejected[0].errors[0].message);
      return;
    }
    if (accepted[0]) {
      setImage(accepted[0]);
      setPreview(URL.createObjectURL(accepted[0]));
      setErrors((prev) => ({ ...prev, image: "" }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".png", ".jpg", ".webp", ".svg"] },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    setPreview(null);
  };

  // ---------- Validate ----------
  const validate = () => {
    const e: typeof errors = {};
    if (!formData.title.trim()) e.title = "Title is required.";
    if (!formData.headLine.trim()) e.headLine = "Headline is required.";
    if (!formData.description.trim()) e.description = "Description is required.";
    if (!formData.link.trim()) e.link = "Redirect link is required.";
    if (!formData.priority.trim()) e.priority = "Priority is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ---------- Submit ----------
  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setIsLoading(true);
      const data = new FormData();
      data.append("title", formData.title);
      data.append("headLine", formData.headLine);
      data.append("description", formData.description);
      data.append("link", formData.link);
      data.append("priority", formData.priority);
      if (image) data.append("image", image);

      await axiosSecure.put(`/banner/update-banner/${slug}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Banner updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["banners"] });
      queryClient.invalidateQueries({ queryKey: ["banner", slug] });
      setTimeout(() => navigate("/banner-list"), 50);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update banner.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <>
        <PageMeta title="Update Banner | Admin Dashboard" description="" />
        <PageBreadcrumb pageTitle="Update Banner" />
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={`Update Banner - ${formData.title}`}
        description="Update banner details"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Update Banner"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/banner-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Banner List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard icon={<FaBullhorn />} title="Banner Content">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label>Title <Req /></Label>
                  <Input
                    type="text"
                    name="title"
                    placeholder="Enter banner title"
                    value={formData.title}
                    onChange={handleChange}
                  />
                  {errors.title && <p className="text-red-500 text-xs mt-1 font-medium">{errors.title}</p>}
                </div>
                <div>
                  <Label>Headline <Req /></Label>
                  <Input
                    type="text"
                    name="headLine"
                    placeholder="Enter headline"
                    value={formData.headLine}
                    onChange={handleChange}
                  />
                  {errors.headLine && <p className="text-red-500 text-xs mt-1 font-medium">{errors.headLine}</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>Description <Req /></Label>
                  <textarea
                    name="description"
                    placeholder="Enter banner description"
                    value={formData.description}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-3 focus:ring-accent-500/20 focus:border-accent-500 text-sm"
                  />
                  {errors.description && <p className="text-red-500 text-xs mt-1 font-medium">{errors.description}</p>}
                </div>
            
              </div>
            </SectionCard>
            <SectionCard icon={<FaLink />} title="Link & Order">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <Label>Redirect Link <Req /></Label>
                  <Input
                    type="text"
                    name="link"
                    placeholder="https://example.com/promo"
                    value={formData.link}
                    onChange={handleChange}
                  />
                  {errors.link && <p className="text-red-500 text-xs mt-1 font-medium">{errors.link}</p>}
                </div>
                <div>
                  <Label>Priority <Req /></Label>
                  <Input
                    type="number"
                    name="priority"
                    placeholder="e.g. 1"
                    value={formData.priority}
                    onChange={handleChange}
                  />
                  {errors.priority && <p className="text-red-500 text-xs mt-1 font-medium">{errors.priority}</p>}
                </div>
              </div>
            </SectionCard>
          </div>
          <SectionCard icon={<FaImage />} title="Banner Image" className="self-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3">
                Banner Image <span className="text-gray-400 font-normal normal-case">(leave empty to keep current)</span>
              </p>
              <div
                {...getRootProps()}
                className={`relative flex flex-col items-center justify-center w-full min-h-50 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
                  ${isDragActive ? "border-accent-500 bg-accent-50 dark:bg-accent-500/5" : "border-gray-300 dark:border-gray-700 hover:border-accent-400"}
                  ${preview ? "border-none p-0" : "p-6"}`}
              >
                <input {...getInputProps()} />
                {!preview ? (
                  <div className="text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 dark:bg-accent-500/10 mb-4">
                      <svg className="h-6 w-6 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {isDragActive ? "Drop image here" : "Click to upload or drag and drop"}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">SVG, PNG, JPG or WEBP · Max 5MB</p>
                  </div>
                ) : (
                  <div className="relative w-full flex justify-center py-4">
                    <div className="relative w-full max-w-full rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-theme-md group">
                      <img
                        src={preview}
                        alt="Banner preview"
                        className="w-full aspect-video h-auto object-cover bg-gray-50 dark:bg-gray-800 transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                            aria-label="Remove image"
                            className="bg-error-500 text-white p-3 rounded-full hover:bg-error-600 transform hover:scale-110 transition-all shadow-xl"
                        >
                          <TrashBinIcon className="size-5" />
                        </button>
                      </div>
                      {image && (
                        <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-black/80 px-3 py-1 rounded-full text-[10px] font-bold text-gray-800 dark:text-white backdrop-blur-sm">
                          {image.name} · {(image.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        <MobileActionBar>
          <div className="flex items-center gap-3 pt-2 justify-end">
            <Link to="/banner-list">
              <button
                type="button"
                className="shine px-6 py-2.5 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </Link>
            <Button
              // @ts-ignore
              type="button"
              onClick={handleSubmit}
              disabled={isLoading}
                className="!bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-2.5 !rounded-xl font-bold text-sm active:scale-95 disabled:opacity-50 shadow-theme-md transition-all"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Updating...</span>
                </div>
              ) : (
                "Update Banner"
              )}
            </Button>
          </div>
        </MobileActionBar>
      </div>
    </>
  );
};

export default BannerUpdate;
