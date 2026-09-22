import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useDropzone } from "react-dropzone";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import { useNavigate, useParams, Link } from "react-router";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import { TrashBinIcon } from "../../icons";
import { useQueryClient } from "@tanstack/react-query";
import { FaArrowLeft } from "react-icons/fa";
import { showApiError } from "../../utils/apiError";

// Portal-based Tooltip component
const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: rect.top - 10 });
      setVisible(true);
    }
  };

  return (
    <div ref={ref} onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)} className="relative inline-block">
      {children}
      {visible && createPortal(
        <div 
          className="fixed z-[9999] px-3 py-1.5 text-[11px] font-bold text-white bg-gray-900 dark:bg-gray-800 rounded-lg shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in duration-200"
          style={{ left: coords.x, top: coords.y }}
        >
          {text}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900 dark:border-t-gray-800" />
        </div>,
        document.body
      )}
    </div>
  );
};

const CategoryUpdate = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState<string>("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        setIsFetching(true);
        const { data } = await axiosSecure.get(`/categories/${slug}`);
        const category = data.data.category;
        setName(category.name);
        setImagePreview(category.image?.url || null);
      } catch (error) {
        showApiError(error, "Error fetching category details");
      } finally {
        setIsFetching(false);
      }
    };

    if (slug) fetchCategory();
  }, [slug]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors[0].code === "file-too-large") {
        toast.error("File is too large. Max size is 5MB.");
      } else if (rejection.errors[0].code === "file-invalid-type") {
        toast.error("Invalid file type. Only images are allowed.");
      } else {
        toast.error(rejection.errors[0].message);
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".png", ".jpg", ".webp", ".svg"],
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    multiple: false,
  });

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImage(null);
    setImagePreview(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (e.target.value.trim()) {
      setErrors({});
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrors({ name: "Category name is required." });
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append("name", name);
    if (image) {
      formData.append("image", image);
    }

    try {
      await axiosSecure.put(`/categories/${slug}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      toast.success("Category updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      navigate("/category-list");
    } catch (error: any) {
      showApiError(error, "Failed to update category");
    } finally {
      setIsLoading(false);
    }
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
      <PageMeta
        title={`Update Category - ${name}`}
        description="Update category details"
      />
      <PageBreadcrumb pageTitle="Update Category" />
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
                    className="size-10 p-0 rounded-xl border-gray-200 dark:border-gray-700 text-gray-500 hover:text-accent-600 transition-all active:scale-90"
                  >
                    <FaArrowLeft className="size-4" />
                  </Button>
                </Tooltip>
                <h2 className="text-md font-medium text-gray-800 dark:text-white/90">
                  Update Category
                </h2>
              </div>
              <Tooltip text="View Category List">
                <Link to="/category-list">
                  <Button size="sm" className="bg-accent-500 hover:bg-accent-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-accent-500/20">
                    Category List
                  </Button>
                </Link>
              </Tooltip>
            </div>
          }
        >
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm w-full">
            <div className="space-y-6">
              <div>
                <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
                  Category Name
                </Label>
                <Input
                  value={name}
                  onChange={handleNameChange}
                  type="text"
                  id="name"
                  placeholder="Enter category name"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>
                )}
              </div>

              <div>
                <Label className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
                  Category Image
                </Label>
                <div
                  {...getRootProps()}
                  className={`
                    relative mt-1.5 flex flex-col items-center justify-center w-full min-h-[200px] 
                    border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
                    ${isDragActive ? "border-brand-500 bg-brand-50 dark:bg-brand-500/5" : "border-gray-300 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-500"}
                    ${imagePreview ? "border-none p-0" : "p-6"}
                  `}
                >
                  <input {...getInputProps()} />
                  
                  {!imagePreview ? (
                    <div className="text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-500/10 mb-4">
                        <svg className="h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">SVG, PNG, JPG or WEBP (Max: 5MB)</p>
                    </div>
                  ) : (
                    <div className="relative w-full flex justify-center py-4">
                      <div className="relative w-full max-w-[400px] aspect-square group overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 shadow-theme-md">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-contain bg-gray-50 dark:bg-gray-800 transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <button
                            onClick={handleRemoveImage}
                              className="bg-accent-500 text-white p-3 rounded-full hover:bg-accent-600 transform hover:scale-110 transition-all duration-200 shadow-xl"
                            title="Remove image"
                          >
                            <TrashBinIcon className="size-6" />
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

              <div className="flex justify-end pt-2">
                <Tooltip text={isLoading ? "Processing..." : "Save Changes"}>
                  <Button
                    className="w-full sm:w-auto bg-accent-500 hover:bg-accent-600 text-white px-8 py-3 rounded-xl transition-all duration-200 shadow-theme-md font-bold text-sm tracking-wide transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                    onClick={handleSubmit}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      "Update Category"
                    )}
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default CategoryUpdate;
