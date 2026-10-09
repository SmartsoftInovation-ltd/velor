import { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useQueryClient } from "@tanstack/react-query";
import { TrashBinIcon } from "../../icons";
import MobileActionBar from "../common/MobileActionBar";
import { showApiError } from "../../utils/apiError";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "create-brand";

const CreateBrandForm = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState<string>(() => draftValue<string>(DRAFT_KEY, "name", ""));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ name }), [name]),
  );
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ name?: string; image?: string }>({});

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
      setPreview(URL.createObjectURL(file));
      setErrors((prev) => ({ ...prev, image: undefined }));
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
    e.stopPropagation(); // prevent triggering dropzone click
    setImage(null);
    setPreview(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (e.target.value.trim()) {
      setErrors((prev) => ({ ...prev, name: undefined }));
    }
  };

  const handleSubmit = async () => {
    const newErrors: { name?: string; image?: string } = {};

    if (!name.trim()) {
      newErrors.name = "Brand name is required.";
    }
    if (!image) {
      newErrors.image = "Brand logo is required.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    setIsLoading(true);

    const formData = new FormData();
    formData.append("name", name);
    if (image) {
      formData.append("image", image);
    }

    try {
      await axiosSecure.post(`/brand`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Brand created successfully!");
      clearDraft(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      setName("");
      setImage(null);
      setPreview(null);
      setErrors({});
    } catch (error) {
      showApiError(error, "Failed to create brand");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm w-full">
      <div className="space-y-6">
        <div>
          <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
            Brand Name
          </Label>
          <Input
            value={name}
            onChange={handleNameChange}
            type="text"
            id="name"
            placeholder="Enter brand name"
            className={errors.name ? "border-red-500" : ""}
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>
          )}
        </div>

        <div>
          <Label className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
            Brand Logo
          </Label>
          <div
            {...getRootProps()}
            className={`
              relative mt-1.5 flex flex-col items-center justify-center w-full min-h-[200px] 
              border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300
              ${isDragActive ? "border-accent-500 bg-accent-50 dark:bg-accent-500/5" : "border-gray-300 dark:border-gray-700 hover:border-accent-400 dark:hover:border-accent-500"}
              ${errors.image ? "border-red-500 bg-red-50 dark:bg-red-500/5" : ""}
              ${preview ? "border-none p-0" : "p-6"}
            `}
          >
            <input {...getInputProps()} />
            
            {!preview ? (
              <div className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 dark:bg-accent-500/10 mb-4">
                  <svg
                    className="h-6 w-6 text-accent-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  SVG, PNG, JPG or WEBP (Max: 5MB)
                </p>
              </div>
            ) : (
              <div className="relative w-full flex justify-center py-4">
                <div className="relative w-full max-w-[400px] aspect-square group overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 shadow-theme-md">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-contain bg-gray-50 dark:bg-gray-800 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button
                      onClick={handleRemoveImage}
                      className="bg-accent-500 text-white p-3 rounded-full hover:bg-accent-600 transform hover:scale-110 transition-all duration-200 shadow-xl"
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      <TrashBinIcon className="size-6" />
                    </button>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-black/80 px-3 py-1 rounded-full text-[10px] font-bold text-gray-800 dark:text-white backdrop-blur-sm border border-white/20">
                    {image?.name} ({(image?.size! / 1024 / 1024).toFixed(2)} MB)
                  </div>
                </div>
              </div>
            )}
          </div>
          {errors.image && !preview && (
            <p className="text-red-500 text-xs mt-2 font-medium">{errors.image}</p>
          )}
        </div>

        <MobileActionBar>
        <div className="flex justify-end pt-2">
          <Button
            className="w-full sm:w-auto !bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 rounded-xl transition-all duration-200 shadow-theme-md font-semibold text-sm tracking-wide transform active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              "Create Brand"
            )}
          </Button>
        </div>
        </MobileActionBar>
      </div>
    </div>
  );
};

export default CreateBrandForm;
