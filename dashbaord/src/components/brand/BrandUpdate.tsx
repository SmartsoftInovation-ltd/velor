import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { FaArrowLeft, FaSync, FaTrashAlt } from "react-icons/fa";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";


// Simplified Tooltip without createPortal to avoid "removeChild" DOM errors
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50 pointer-events-none animate-in fade-in zoom-in duration-150">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
};

const BrandUpdate = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string>("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const { data: brand, isLoading: isFetching } = useQuery({
    queryKey: ["brand", slug],
    queryFn: async () => {
      const { data } = await axiosSecure.get(`/brand/${slug}`);
      return data.data.brand;
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (brand) {
      setName(brand.name || "");
      setImagePreview(brand.image?.url || null);
    }
  }, [brand]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0].code === "file-too-large") {
        toast.error("File is too large. Max size is 5MB.");
      } else {
        toast.error("Invalid file selection.");
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setImage(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
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
    setImagePreview(null);
  };

  const mutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return await axiosSecure.put(`/brand/${slug}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.success("Brand updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      // Redirect after a very short delay to avoid unmount race conditions
      setTimeout(() => navigate("/brand-list"), 50);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update brand");
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      setErrors({ name: "Brand name is required." });
      return;
    }

    const formData = new FormData();
    formData.append("name", name.trim());
    if (image) {
      formData.append("image", image);
    }

    mutation.mutate(formData);
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageMeta title={`Update Brand - ${name}`} description="Update brand details" />
      <PageBreadcrumb pageTitle="Update Brand" />

      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center w-full">
              <div className="flex items-center gap-3">
                <Tooltip text="Go Back">
                  <Button
                    onClick={() => navigate(-1)}
                    size="sm"
                    variant="outline"
                    className="size-10 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-brand-500 transition-all flex items-center justify-center"
                  >
                    <FaArrowLeft className="size-4" />
                  </Button>
                </Tooltip>
                <h2 className="text-md font-medium text-gray-800 dark:text-white uppercase">
                  Update Brand
                </h2>
              </div>
              <Tooltip text="View Brand List">
                <Link to="/brand-list">
                  <Button size="sm" className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg font-bold">
                    Brand List
                  </Button>
                </Link>
              </Tooltip>
            </div>
          }
        >
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 w-full">
            <div className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
                  Brand Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (e.target.value.trim()) setErrors({});
                  }}
                  type="text"
                  id="name"
                  placeholder="Enter brand name"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
                  Brand Logo
                </Label>
                <div
                  {...getRootProps()}
                  className={`relative mt-1.5 flex flex-col items-center justify-center w-full min-h-[250px] border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${
                    isDragActive ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-brand-400"
                  } ${imagePreview ? "border-none p-0" : "p-6"}`}
                >
                  <input {...getInputProps()} />
                  {!imagePreview ? (
                    <div className="text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 mb-4">
                        <svg className="h-7 w-7 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600 font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1 uppercase font-bold tracking-widest">SVG, PNG, JPG (Max: 5MB)</p>
                    </div>
                  ) : (
                    <div className="relative w-full flex justify-center py-6">
                      <div className="relative w-full max-w-[400px] aspect-square group overflow-hidden rounded-2xl border bg-gray-50 dark:bg-gray-800">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                              className="bg-[#D5F0E3] text-[#0A6B43] p-3 rounded-full hover:bg-[#B8E4CF] shadow-xl"
                          >
                            <FaTrashAlt className="size-6" />
                          </button>
                        </div>
                        {image && (
                          <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-black/80 px-3 py-1 rounded-full text-[10px] font-bold text-gray-800 dark:text-white backdrop-blur-sm border border-white/20">
                            {image.name} ({(image.size / 1024 / 1024).toFixed(2)} MB)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                <Button
                  onClick={handleSubmit}
                    className="w-full sm:w-auto bg-[#D5F0E3] hover:bg-[#B8E4CF] text-[#0A6B43] px-10 py-3.5 rounded-xl font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-3 shadow-lg"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <FaSync className="size-4" />
                      Update Brand
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default BrandUpdate;
