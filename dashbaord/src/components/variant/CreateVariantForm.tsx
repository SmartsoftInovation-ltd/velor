import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import SearchableSelect from "../form/SearchableSelect";
import Select from "../form/Select";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { FaTrashAlt, FaCloudUploadAlt, FaGlobe, FaRulerCombined, FaBarcode, FaSync, FaTimesCircle } from "react-icons/fa";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { MdDelete, MdOutlineQrCodeScanner } from "react-icons/md";
import { showApiError } from "../../utils/apiError";
import { scopedStorageKey } from "../../lib/session";

type VariantFormData = {
  product?: string;
  variantName: string;
  size?: string;
  color?: string;
  sku?: string;
  barCode?: string;
  weight?: number;
  dimensions?: { width: number; height: number; depth: number };
  seo?: {
    metaTitle: string;
    metaDescription: string;
    metaKeywords: string[];
    focusKeyword: string;
    ogTitle?: string;
    ogDescription?: string;
  };
  unit?: string;
  groupUnit?: string;
  groupUnitQuantity?: number;
  specifications?: string;
  stockVariant?: number;
  purchasePrice?: number;
  retailPrice?: number;
  retailPriceType?: string;
  retailProfitMarginbyAmount?: number;
  retailProfitMarginByPercentage?: number;
  wholesalePrice?: number;
  wholesalePriceType?: string;
  wholesaleProfitMarginAmount?: number;
  wholesaleProfitMarginPercentage?: number;
  alertVariantStock?: number;
  slug?: string;
  image?: File[];
  ogImage?: File | null;
  thumbnail?: File | null;
};
interface Product {
  _id: string;
  name: string;
}

interface CreateVariantFormProps {
  isUpdate?: boolean;
  initialData?: VariantFormData | null;
}

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "clean"],
  ],
};

// --- IndexedDB Helpers for Draft Files ---
const DB_NAME = "VariantDraftDB";
const STORE_NAME = "draft_files";

// The record key is namespaced per store: one IndexedDB database serves the
// whole browser, so an unscoped key would restore one store's draft images
// into the next store signed in on the same machine.
const variantDraftFilesKey = () => scopedStorageKey("variant_draft_files_key");

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveDraftFiles = async (
  filesMap: Array<{ image: File[]; thumbnail: File | null; ogImage: File | null }>
) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(filesMap, variantDraftFilesKey());
  } catch (e) {
    console.error("Failed to save files to IndexedDB", e);
  }
};

const getDraftFiles = async (): Promise<
  Array<{ image: File[]; thumbnail: File | null; ogImage: File | null }> | null
> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(variantDraftFilesKey());
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error("Failed to get files from IndexedDB", e);
    return null;
  }
};

const clearDraftFiles = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(variantDraftFilesKey());
  } catch (e) {
    console.error("Failed to clear IndexedDB files", e);
  }
};


const SectionCard = ({ icon, title, children, className = "" }: any) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm overflow-hidden ${className}`}>
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="flex items-center justify-center size-8 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500">{icon}</div>
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const MultiImageZone = ({ images, onDrop, onRemove, label }: any) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { "image/*": [] },
    maxFiles: 10,
    maxSize: 5 * 1024 * 1024
  });

  return (
    <div className="space-y-4">
      <div {...getRootProps()} className={`relative  flex flex-col items-center justify-center w-full border-2 border-dashed rounded-2xl py-8 px-6 cursor-pointer transition-all duration-300 ${isDragActive ? "border-brand-500 bg-brand-50" : "border-gray-200 dark:border-gray-700 hover:border-brand-400"}`}>
        <input {...getInputProps()} />
        <div className="text-center">
          <div className="size-14 mx-auto mb-3 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-500"><FaCloudUploadAlt className="text-2xl" /></div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{label}</p>
          <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-tight">Up to 10 images. Max 5MB each.</p>
        </div>
      </div>
      
      {images && images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
          {images.map((img: string, idx: number) => (
            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 group shadow-sm">
              <img src={img} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button type="button" onClick={() => onRemove(idx)} className="bg-red-500 text-white p-2 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300"><FaTrashAlt className="size-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const DropZone = ({ onDrop, multiple = false, preview, onRemove, label, height = "py-8" }: any) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple, accept: { "image/*": [] }, maxSize: 5 * 1024 * 1024 });
  return (
    <div {...getRootProps()} className={`relative  flex flex-col items-center justify-center w-full border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${isDragActive ? "border-brand-500 bg-brand-50" : "border-gray-200 dark:border-gray-700 hover:border-brand-400"} ${preview ? "border-none p-0" : height + " px-6"}`}>
      <input {...getInputProps()} />
      {preview ? (
        <div className="relative w-full aspect-[1.91/1] rounded-xl overflow-hidden shadow-theme-md bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 group">
          <img src={preview} className="w-full h-full object-contain" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="bg-red-500 text-white p-3 rounded-full shadow-xl transform scale-75 group-hover:scale-100 transition-all duration-300"><FaTrashAlt /></button>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <div className="size-14 mx-auto mb-3 bg-brand-50 dark:bg-brand-500/10 rounded-2xl flex items-center justify-center text-brand-500"><FaCloudUploadAlt className="text-2xl" /></div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{label}</p>
          <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-tight">PNG, JPG or WebP (Max 5MB)</p>
        </div>
      )}
    </div>
  );
};

const GalleryDropZone = ({ onDrop, galleryCount }: any) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true, accept: { "image/*": [] }, maxSize: 5 * 1024 * 1024 });
  return (
    <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl py-5 px-4 text-center cursor-pointer transition-all duration-300 ${isDragActive ? "border-brand-500 bg-brand-50" : "border-gray-200 dark:border-gray-700 hover:border-brand-400 bg-gray-50/50 dark:bg-gray-800/30"}`}>
      <input {...getInputProps()} />
      <FaCloudUploadAlt className="mx-auto text-3xl text-gray-300 dark:text-gray-600 mb-2" />
      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Add Gallery Images</p>
      <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tight">{galleryCount}/10 Uploaded</p>
    </div>
  );
};

const CreateVariantForm = ({
  isUpdate = false,
  initialData = null,
}: CreateVariantFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Per-row barcode input refs — a USB scanner just types into whatever has
  // focus, so clicking the scanner icon on a row focuses that row's field.
  const barcodeInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const focusBarcodeInput = (formIndex: number) => {
    barcodeInputRefs.current.get(formIndex)?.focus();
  };

  // Edit-mode "Stock Variant" input — deliberately kept OUTSIDE the
  // variantForms array. On update, this is the only thing sent for stock,
  // and it maps straight to initialStock on the backend (never stockVariant).
  // Isolated in its own state so it can't be affected by anything else
  // touching variantForms.
  const [initialStockInput, setInitialStockInput] = useState<number>(() => {
    if (!isUpdate) return 0;
    const actualData = (initialData as any)?.variant || initialData;
    return actualData?.initialStock ?? actualData?.stockVariant ?? 0;
  });

  const [existingGallery, setExistingGallery] = useState<{ url: string; publicId: string }[]>(() => {
    const actualData = (initialData as any)?.variant || initialData;
    const initialImages = actualData?.image
      ? (Array.isArray(actualData.image)
          ? actualData.image.filter((img: any) => img && typeof img === "object" && img.url)
          : [])
      : [];
    return initialImages;
  });

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isDeletingImages, setIsDeletingImages] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const [gallery, setGallery] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

  const onGalleryDrop = (acceptedFiles: File[]) => {
    if (gallery.length + existingGallery.length + acceptedFiles.length > 10) {
      toast.error("Maximum 10 images allowed per variant");
      return;
    }
    setGallery(p => [...p, ...acceptedFiles]);
    setGalleryPreviews(p => [...p, ...acceptedFiles.map(file => URL.createObjectURL(file))]);
  };

  const removeNewGalleryImage = (i: number) => {
    setGallery(p => p.filter((_, idx) => idx !== i));
    setGalleryPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const toggleImageSelection = (publicId: string) => {
    setSelectedImages(prev => 
      prev.includes(publicId) ? prev.filter(id => id !== publicId) : [...prev, publicId]
    );
  };

  const handleDeleteGalleryImages = async () => {
    const actualData = (initialData as any)?.variant || initialData;
    const slugVal = actualData?.slug || (initialData as any)?.slug;
    if (!slugVal || selectedImages.length === 0) return;
    setIsDeletingImages(true);
    try {
      await axiosSecure.delete(`/deletevariantimage/${slugVal}`, {
        data: { publicId: selectedImages }
      });
      toast.success("Images deleted successfully!");
      setSelectedImages([]);
      // Refetch variant data to sync UI
      const res = await axiosSecure.get(`/variant/${slugVal}`);
      const v = res?.data?.data?.variant || res?.data?.data;
      if (v) {
        setExistingGallery(v.image || []);
      }
    } catch (error) {
      showApiError(error, "Failed to delete images.");
      console.error(error);
    } finally {
      setIsDeletingImages(false);
    }
  };

  const handleAddExtraImages = async () => {
    const actualData = (initialData as any)?.variant || initialData;
    const slugVal = actualData?.slug || (initialData as any)?.slug;
    if (!slugVal || gallery.length === 0) return;
    setIsUploadingImages(true);
    const data = new FormData();
    gallery.forEach(file => data.append("image", file));

    try {
      await axiosSecure.post(`/addvariantimage/${slugVal}`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Images added successfully!");
      setGallery([]);
      setGalleryPreviews([]);
      // Refetch variant data to sync UI
      const res = await axiosSecure.get(`/variant/${slugVal}`);
      const v = res?.data?.data?.variant || res?.data?.data;
      if (v) {
        setExistingGallery(v.image || []);
      }
    } catch (error) {
      showApiError(error, "Failed to add images.");
      console.error(error);
    } finally {
      setIsUploadingImages(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    const actualData = (initialData as any)?.variant || initialData;
    const slugVal = actualData?.slug || (initialData as any)?.slug;
    if (!slugVal) return;
    setIsRefreshing(true);
    try {
      const res = await axiosSecure.get(`/variant/${slugVal}`);
      const v = res?.data?.data?.variant || res?.data?.data;
      if (v) {
        setExistingGallery(v.image || []);
        setInitialStockInput(v.initialStock ?? v.stockVariant ?? 0);

        const productVal = v.product
          ? (typeof v.product === "object" ? (v.product as any)._id : v.product)
          : "";

        setVariantForms(prev => prev.map((f, i) => i === 0 ? {
          ...f,
          formData: {
            ...f.formData,
            product: productVal,
            variantName: v.variantName || "",
            size: v.size || "",
            color: v.color || "",
            sku: v.sku || "",
            barCode: v.barCode || "",
            weight: v.weight || 0,
            dimensions: v.dimensions || { width: 0, height: 0, depth: 0 },
            seo: v.seo || { 
              metaTitle: "", 
              metaDescription: "", 
              metaKeywords: [], 
              focusKeyword: "",
              ogTitle: "",
              ogDescription: ""
            },
            unit: v.unit || "Piece",
            groupUnit: v.groupUnit || "",
            groupUnitQuantity: v.groupUnitQuantity || 0,
            specifications: v.specifications || "",
            purchasePrice: v.purchasePrice || 0,
            stockVariant: v.initialStock || 0,
            retailPrice: v.retailPrice || 0,
            retailPriceType: "TK",
            retailProfitMarginbyAmount: v.retailProfitMarginbyAmount || 0,
            retailProfitMarginByPercentage: v.retailProfitMarginByPercentage || 0,
            wholesalePrice: v.wholesalePrice || 0,
            wholesalePriceType: "TK",
            wholesaleProfitMarginAmount: v.wholesaleProfitMarginAmount || 0,
            wholesaleProfitMarginPercentage: v.wholesaleProfitMarginPercentage || 0,
            alertVariantStock: v.alertVariantStock || 0,
          }
        } : f));
        
        toast.success("Variant data refreshed successfully!");
      }
    } catch (error) {
      showApiError(error, "Failed to refresh variant data.");
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const [variantForms, setVariantForms] = useState<
    Array<{
      formData: VariantFormData;
      selectedType: string;
      selectedRetailType: string;
      errors: Partial<Record<keyof VariantFormData, string>>;
      imagePreview: string[];
      ogImagePreview: string | null;
      thumbnailPreview: string | null;
      tagInput: string;
      colorInput: string;
    }>
  >(() => {
    // Attempt to load draft from localStorage for new variants
    if (!isUpdate) {
      try {
        const savedDraft = localStorage.getItem(scopedStorageKey("variant_form_draft"));
        if (savedDraft) {
          const parsedDraft = JSON.parse(savedDraft);
          if (Array.isArray(parsedDraft) && parsedDraft.length > 0) {
            // Clean up files and blob previews from the loaded draft
            return parsedDraft.map((form: any) => ({
              ...form,
              formData: {
                ...form.formData,
                image: [],
                ogImage: null,
                thumbnail: null,
              },
              imagePreview: [],
              ogImagePreview: null,
              thumbnailPreview: null,
              errors: {}, // Reset validation errors on reload
            }));
          }
        }
      } catch (e) {
        console.error("Failed to load draft from localStorage", e);
      }
    }

    const actualData = (initialData as any)?.variant || initialData;

    const productVal = actualData?.product 
      ? (typeof actualData.product === "object" ? (actualData.product as any)._id : actualData.product)
      : "";

    const initialImages = actualData?.image
      ? (Array.isArray(actualData.image)
          ? actualData.image.map((img: any) => typeof img === "string" ? img : img.url)
          : [])
      : [];

    const initialThumbnail = actualData?.thumbnail
      ? (typeof actualData.thumbnail === "string" ? actualData.thumbnail : (actualData.thumbnail as any).url)
      : null;

    const initialOgImage = actualData?.ogImage 
      ? (typeof actualData.ogImage === "string" ? actualData.ogImage : (actualData.ogImage as any).url)
      : null;

    return [
      {
        formData: {
          product: productVal,
          variantName: actualData?.variantName || "",
          size: actualData?.size || "",
          color: actualData?.color || "",
          sku: actualData?.sku || "",
          barCode: actualData?.barCode || "",
          weight: actualData?.weight || 0,
          dimensions: actualData?.dimensions || { width: 0, height: 0, depth: 0 },
          seo: actualData?.seo || { 
            metaTitle: "", 
            metaDescription: "", 
            metaKeywords: [], 
            focusKeyword: "",
            ogTitle: "",
            ogDescription: ""
          },
          unit: actualData?.unit || "Piece",
          groupUnit: actualData?.groupUnit || "",
          groupUnitQuantity: actualData?.groupUnitQuantity || 0,
          specifications: actualData?.specifications || "",
          purchasePrice: actualData?.purchasePrice || 0,
          stockVariant: actualData?.initialStock || 0,
          retailPrice: actualData?.retailPrice || 0,
          retailPriceType: "TK",
          retailProfitMarginbyAmount:
            actualData?.retailProfitMarginbyAmount || 0,
          retailProfitMarginByPercentage:
            actualData?.retailProfitMarginByPercentage || 0,
          wholesalePrice: actualData?.wholesalePrice || 0,
          wholesalePriceType: "TK",
          wholesaleProfitMarginAmount:
            actualData?.wholesaleProfitMarginAmount || 0,
          wholesaleProfitMarginPercentage:
            actualData?.wholesaleProfitMarginPercentage || 0,
          alertVariantStock: actualData?.alertVariantStock || 0,
          image: [],
          ogImage: null,
          thumbnail: null,
        },
        selectedType: "TK",
        selectedRetailType: "TK",
        errors: {},
        imagePreview: initialImages,
        ogImagePreview: initialOgImage,
        thumbnailPreview: initialThumbnail,
        tagInput: "",
        colorInput: "",
      },
    ];
  });

  // --- Draft Persistence Logic ---
  const isRestored = useRef(false);

  // Restore draft files and recreate preview URLs on mount
  useEffect(() => {
    if (!isUpdate) {
      const restoreFiles = async () => {
        try {
          const savedFiles = await getDraftFiles();
          if (savedFiles && savedFiles.length > 0) {
            setVariantForms((prev) => {
              // Only restore if the number of forms matches the saved draft forms length
              if (prev.length !== savedFiles.length) return prev;

              return prev.map((form, idx) => {
                const fileData = savedFiles[idx];
                if (!fileData) return form;

                // Recreate URL previews
                const imagePreviews = (fileData.image || []).map((file) =>
                  URL.createObjectURL(file)
                );
                const thumbnailPreview = fileData.thumbnail
                  ? URL.createObjectURL(fileData.thumbnail)
                  : null;
                const ogImagePreview = fileData.ogImage
                  ? URL.createObjectURL(fileData.ogImage)
                  : null;

                return {
                  ...form,
                  formData: {
                    ...form.formData,
                    image: fileData.image || [],
                    thumbnail: fileData.thumbnail || null,
                    ogImage: fileData.ogImage || null,
                  },
                  imagePreview: imagePreviews,
                  thumbnailPreview: thumbnailPreview,
                  ogImagePreview: ogImagePreview,
                };
              });
            });
          }
        } catch (e) {
          console.error("Failed to restore files from IndexedDB", e);
        } finally {
          isRestored.current = true;
        }
      };
      restoreFiles();
    } else {
      isRestored.current = true;
    }
  }, [isUpdate]);

  // Save draft to localStorage and IndexedDB whenever forms change (after restoring is complete)
  useEffect(() => {
    if (!isUpdate && isRestored.current) {
      // Save text fields to localStorage
      const draftToSave = variantForms.map((form) => ({
        ...form,
        formData: {
          ...form.formData,
          image: [], // Don't save files in localStorage
          ogImage: null,
          thumbnail: null, // Don't save files
        },
        imagePreview: [],
        ogImagePreview: null,
        thumbnailPreview: null, // Don't save preview blob URLs
      }));
      localStorage.setItem(scopedStorageKey("variant_form_draft"), JSON.stringify(draftToSave));

      // Save binary file objects to IndexedDB
      const filesToSave = variantForms.map((form) => ({
        image: form.formData.image || [],
        thumbnail: form.formData.thumbnail || null,
        ogImage: form.formData.ogImage || null,
      }));
      saveDraftFiles(filesToSave);
    }
  }, [variantForms, isUpdate]);

  // Manage and clean up Object URLs to prevent memory leaks
  const prevUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Collect all active preview URLs from the state
    const currentUrls = new Set<string>();

    variantForms.forEach((form) => {
      if (form.imagePreview) {
        form.imagePreview.forEach((url) => {
          if (url && url.startsWith("blob:")) {
            currentUrls.add(url);
          }
        });
      }
      if (form.thumbnailPreview && form.thumbnailPreview.startsWith("blob:")) {
        currentUrls.add(form.thumbnailPreview);
      }
      if (form.ogImagePreview && form.ogImagePreview.startsWith("blob:")) {
        currentUrls.add(form.ogImagePreview);
      }
    });

    // Also include galleryPreviews if they exist
    if (galleryPreviews) {
      galleryPreviews.forEach((url) => {
        if (url && url.startsWith("blob:")) {
          currentUrls.add(url);
        }
      });
    }

    // Revoke any URLs that were previously active but are no longer in use
    prevUrlsRef.current.forEach((url) => {
      if (!currentUrls.has(url)) {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error("Failed to revoke object URL", e);
        }
      }
    });

    // Keep track of the current URLs for the next update
    prevUrlsRef.current = currentUrls;

    // Cleanup function: revoke all URLs when the component unmounts
    return () => {
      prevUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error("Failed to revoke object URL during cleanup", e);
        }
      });
    };
  }, [variantForms, galleryPreviews]);

  // Centralized Autocalculation Effect
  useEffect(() => {
    setVariantForms((prev) => {
      const updatedForms = prev.map((form) => {
        const purchase = parseFloat(form.formData.purchasePrice?.toString() || "0");
        if (isNaN(purchase) || purchase <= 0) return form;

        let updates: Partial<VariantFormData> = {};

        // Retail Calculation
        if (form.selectedRetailType === "Percentage" && form.formData.retailProfitMarginByPercentage) {
          const val = parseFloat(form.formData.retailProfitMarginByPercentage.toString());
          const calculated = Math.round(purchase + (purchase * val) / 100);
          if (form.formData.retailPrice !== calculated) {
            updates.retailPrice = calculated;
          }
        }

        // Wholesale Calculation
        if (form.selectedType === "Percentage" && form.formData.wholesaleProfitMarginPercentage) {
          const val = parseFloat(form.formData.wholesaleProfitMarginPercentage.toString());
          const calculated = Math.round(purchase + (purchase * val) / 100);
          if (form.formData.wholesalePrice !== calculated) {
            updates.wholesalePrice = calculated;
          }
        }

        if (Object.keys(updates).length > 0) {
          return {
            ...form,
            formData: { ...form.formData, ...updates },
          };
        }
        return form;
      });

      // Avoid infinite loop by checking if state actually changed
      const isChanged = JSON.stringify(prev) !== JSON.stringify(updatedForms);
      return isChanged ? updatedForms : prev;
    });
  }, [variantForms]);

  const { data: productOptions = [] } = useQuery({
    queryKey: ["multipleVariantProducts"],
    queryFn: async () => {
      const res = await axiosSecure.get(`/product/multiplevarinatproduct`);
      // The API response structure is { data: { products: [...] } }
      const products = res.data?.data?.products || [];
      console.log("products", products);
      return products.map((p: Product) => ({
        value: p._id,
        label: p.name,
      }));
    },
  });

  const handleInputChange = (
    formIndex: number,
    field: keyof VariantFormData,
    value: string | number | string[] | File | null
  ) => {
    setVariantForms((prev) =>
      prev.map((form, index) =>
        index === formIndex
          ? {
              ...form,
              formData: { ...form.formData, [field]: value },
              errors: { ...form.errors, [field]: "" },
            }
          : form
      )
    );
  };

  const handleCustomInputChange = (
    formIndex: number,
    name: string,
    value: string
  ) => {
    const numericValue = parseFloat(value) || 0;
    setVariantForms((prev) =>
      prev.map((form, index) =>
        index === formIndex
          ? {
              ...form,
              formData: { ...form.formData, [name]: numericValue },
              errors: { ...form.errors, [name]: "" },
            }
          : form
      )
    );
  };

  const handleTypeChange = (formIndex: number, value: string) => {
    setVariantForms((prev) =>
      prev.map((form, index) =>
        index === formIndex
          ? {
              ...form,
              selectedType: value,
              formData: {
                ...form.formData,
                wholesalePriceType: value,
                wholesaleProfitMarginAmount: 0,
                wholesaleProfitMarginPercentage: 0,
              },
            }
          : form
      )
    );
  };

  const handleRetailTypeChange = (formIndex: number, value: string) => {
    setVariantForms((prev) =>
      prev.map((form, index) =>
        index === formIndex
          ? {
              ...form,
              selectedRetailType: value,
              formData: {
                ...form.formData,
                retailPriceType: value,
                retailProfitMarginbyAmount: 0,
                retailProfitMarginbyPercentance: 0,
              },
            }
          : form
      )
    );
  };

  const validateForm = (formData: VariantFormData, _formIndex: number) => {
    const newErrors: Partial<Record<keyof VariantFormData, string>> = {};

    if (!formData.product) newErrors.product = "Product is required";
    if (!formData.variantName)
      newErrors.variantName = "Variant Name is required";
    if (!formData.color || formData.color.trim().length === 0)
      newErrors.color = "Color is required";
    if (!formData.purchasePrice || formData.purchasePrice <= 0)
      newErrors.purchasePrice =
        "Purchase Price is required and must be greater than 0";
    if (!formData.retailPrice || formData.retailPrice <= 0)
      newErrors.retailPrice =
        "Retail Price is required and must be greater than 0";
    
    return { errors: newErrors, isValid: Object.keys(newErrors).length === 0 };
  };

  const addNewRow = () => {
    const newForm = {
      formData: {
        product: "",
        variantName: "",
        size: "",
        color: "",
        sku: "",
        barCode: "",
        weight: 0,
        dimensions: { width: 0, height: 0, depth: 0 },
        seo: { 
          metaTitle: "", 
          metaDescription: "", 
          metaKeywords: [], 
          focusKeyword: "",
          ogTitle: "",
          ogDescription: ""
        },
        unit: "Piece",
        groupUnit: "",
        groupUnitQuantity: 0,
        specifications: "",
        stockVariant: 0,
        purchasePrice: 0,
        retailPrice: 0,
        retailPriceType: "TK",
        wholesalePrice: 0,
        wholesalePriceType: "TK",
        alertVariantStock: 0,
        retailProfitMarginbyAmount: 0,
        retailProfitMarginByPercentage: 0,
        wholesaleProfitMarginAmount: 0,
        wholesaleProfitMarginPercentage: 0,
        image: [],
        ogImage: null,
        thumbnail: null,
      },
      selectedType: "TK",
      selectedRetailType: "TK",
      errors: {},
      imagePreview: [],
      ogImagePreview: null,
      thumbnailPreview: null,
      tagInput: "",
      colorInput: "",
    };
    setVariantForms((prev) => [...prev, newForm]);
  };

  const removeRow = (formIndex: number) => {
    if (variantForms.length > 1) {
      setVariantForms((prev) => prev.filter((_, index) => index !== formIndex));
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    try {
      // Validate all forms
      const validatedForms = variantForms.map((form, index) => {
        const validation = validateForm(form.formData, index);
        return {
          ...form,
          errors: validation.errors,
          isValid: validation.isValid,
        };
      });

      setVariantForms(validatedForms);

      const allValid = validatedForms.every((form) => form.isValid);
      if (!allValid) {
        toast.error("Please fix all validation errors");
        setIsLoading(false);
        return;
      }

      // ✅ Build FormData according to API expectations
      const formData = new FormData();

      if (isUpdate) {
        // Flat payload for single update
        const fData = validatedForms[0].formData;

        formData.append("product", fData.product || "");
        formData.append("variantName", fData.variantName || "");
        formData.append("size", fData.size || "");
        formData.append("color", fData.color || "");
        formData.append("sku", fData.sku || "");
        formData.append("barCode", fData.barCode || "");
        formData.append("weight", (fData.weight || 0).toString());
        formData.append("purchasePrice", (fData.purchasePrice || 0).toString());
        formData.append("retailPrice", (fData.retailPrice || 0).toString());
        formData.append("wholesalePrice", (fData.wholesalePrice || 0).toString());
        // Sent as "stockVariant" (the field name the backend expects), but
        // sourced from the isolated initialStockInput state — the backend's
        // updateVariant controller redirects this into initialStock only,
        // never touching the live stockVariant counter.
        formData.append("stockVariant", initialStockInput.toString());
        formData.append("alertVariantStock", (fData.alertVariantStock || 0).toString());
        formData.append("alertQuantity", (fData.alertVariantStock || 0).toString());

        // Dimensions
        if (fData.dimensions) {
          formData.append("dimensions[width]", (fData.dimensions.width || 0).toString());
          formData.append("dimensions[height]", (fData.dimensions.height || 0).toString());
          formData.append("dimensions[depth]", (fData.dimensions.depth || 0).toString());
        }

        // SEO
        if (fData.seo) {
          formData.append("seo[metaTitle]", fData.seo.metaTitle || "");
          formData.append("seo[metaDescription]", fData.seo.metaDescription || "");
          formData.append("seo[focusKeyword]", fData.seo.focusKeyword || "");
          formData.append("seo[ogTitle]", fData.seo.ogTitle || "");
          formData.append("seo[ogDescription]", fData.seo.ogDescription || "");
          if (fData.seo.metaKeywords && fData.seo.metaKeywords.length > 0) {
            fData.seo.metaKeywords.forEach((val, idx) => formData.append(`seo[metaKeywords][${idx}]`, val));
          }
        }

        if (fData.unit) formData.append("unit", fData.unit);
        if (fData.groupUnit) formData.append("groupUnit", fData.groupUnit);
        if (fData.groupUnitQuantity) formData.append("groupUnitQuantity", fData.groupUnitQuantity.toString());
        if (fData.specifications) formData.append("specifications", fData.specifications);

        // Images
        if (fData.image && fData.image.length > 0) {
          fData.image.forEach((file: File) => {
            formData.append("image", file);
          });
        }
        if (fData.ogImage) {
          formData.append("ogImage", fData.ogImage);
        }
        if (fData.thumbnail) {
          formData.append("thumbnail", fData.thumbnail);
        }

        // Profit Margins
        if (validatedForms[0].selectedRetailType === "Percentage") {
          formData.append("retailProfitMarginByPercentage", (fData.retailProfitMarginByPercentage || 0).toString());
        }
        if (validatedForms[0].selectedType === "Percentage") {
          formData.append("wholesaleProfitMarginPercentage", (fData.wholesaleProfitMarginPercentage || 0).toString());
        }
      } else {
        // Nested array for bulk creation
        validatedForms.forEach((form, index) => {
          const fData = form.formData;
          formData.append(`variants[${index}][product]`, fData.product || "");
          formData.append(`variants[${index}][variantName]`, fData.variantName || "");
          formData.append(`variants[${index}][size]`, fData.size || "");
          formData.append(`variants[${index}][color]`, fData.color || "");
          formData.append(`variants[${index}][sku]`, fData.sku || "");
          formData.append(`variants[${index}][barCode]`, fData.barCode || "");
          formData.append(`variants[${index}][weight]`, (fData.weight || 0).toString());
          formData.append(`variants[${index}][purchasePrice]`, (fData.purchasePrice || 0).toString());
          formData.append(`variants[${index}][retailPrice]`, (fData.retailPrice || 0).toString());
          formData.append(`variants[${index}][wholesalePrice]`, (fData.wholesalePrice || 0).toString());
          formData.append(`variants[${index}][stockVariant]`, (fData.stockVariant || 0).toString());
          formData.append(`variants[${index}][alertQuantity]`, (fData.alertVariantStock || 0).toString());

          if (fData.dimensions) {
            formData.append(`variants[${index}][dimensions][width]`, (fData.dimensions.width || 0).toString());
            formData.append(`variants[${index}][dimensions][height]`, (fData.dimensions.height || 0).toString());
            formData.append(`variants[${index}][dimensions][depth]`, (fData.dimensions.depth || 0).toString());
          }

          if (fData.seo) {
            formData.append(`variants[${index}][seo][metaTitle]`, fData.seo.metaTitle || "");
            formData.append(`variants[${index}][seo][metaDescription]`, fData.seo.metaDescription || "");
            formData.append(`variants[${index}][seo][focusKeyword]`, fData.seo.focusKeyword || "");
            formData.append(`variants[${index}][seo][ogTitle]`, fData.seo.ogTitle || "");
            formData.append(`variants[${index}][seo][ogDescription]`, fData.seo.ogDescription || "");
            if (fData.seo.metaKeywords && fData.seo.metaKeywords.length > 0) {
              fData.seo.metaKeywords.forEach((val, idx) => formData.append(`variants[${index}][seo][metaKeywords][${idx}]`, val));
            }
          }

          if (fData.unit) formData.append(`variants[${index}][unit]`, fData.unit);
          if (fData.groupUnit) formData.append(`variants[${index}][groupUnit]`, fData.groupUnit);
          if (fData.groupUnitQuantity) formData.append(`variants[${index}][groupUnitQuantity]`, fData.groupUnitQuantity.toString());
          if (fData.specifications) formData.append(`variants[${index}][specifications]`, fData.specifications);

          if (fData.image && fData.image.length > 0) {
            fData.image.forEach((file: File) => {
              formData.append(`variants[${index}][image]`, file);
            });
          }
          if (fData.ogImage) {
            formData.append(`variants[${index}][ogImage]`, fData.ogImage);
          }
          if (fData.thumbnail) {
            formData.append(`variants[${index}][thumbnail]`, fData.thumbnail);
          }

          if (form.selectedRetailType === "Percentage") {
            formData.append(`variants[${index}][retailProfitMarginByPercentage]`, (fData.retailProfitMarginByPercentage || 0).toString());
          }
          if (form.selectedType === "Percentage") {
            formData.append(`variants[${index}][wholesaleProfitMarginPercentage]`, (fData.wholesaleProfitMarginPercentage || 0).toString());
          }
        });
      }

      // Debug: Log FormData contents
      console.log("FormData contents:");
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      // ✅ Send API request
      const actualData = (initialData as any)?.variant || initialData;
      const slugVal = actualData?.slug || (initialData as any)?.slug;

      if (isUpdate && slugVal) {
        await axiosSecure.put(`/variant/${slugVal}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Variant updated successfully!");
        await queryClient.invalidateQueries({ queryKey: ["variants"] });
        navigate("/variant-list");
      } else {
        await axiosSecure.post(`/variant`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Variants created successfully!");
        await queryClient.invalidateQueries({ queryKey: ["variants"] });
        localStorage.removeItem(scopedStorageKey("variant_form_draft"));
        clearDraftFiles();

        // Reset form
        setVariantForms([
          {
            formData: {
              product: "",
              variantName: "",
              size: "",
              color: "",
              sku: "",
              barCode: "",
              weight: 0,
              dimensions: { width: 0, height: 0, depth: 0 },
              seo: { 
                metaTitle: "", 
                metaDescription: "", 
                metaKeywords: [], 
                focusKeyword: "",
                ogTitle: "",
                ogDescription: ""
              },
              unit: "Piece",
              groupUnit: "",
              groupUnitQuantity: 0,
              specifications: "",
              stockVariant: 0,
              purchasePrice: 0,
              retailPrice: 0,
              retailPriceType: "TK",
              wholesalePrice: 0,
              wholesalePriceType: "TK",
              alertVariantStock: 0,
              retailProfitMarginbyAmount: 0,
              retailProfitMarginByPercentage: 0,
              wholesaleProfitMarginAmount: 0,
              wholesaleProfitMarginPercentage: 0,
              image: [],
              ogImage: null,
              thumbnail: null,
            },
            selectedType: "TK",
            selectedRetailType: "TK",
            errors: {},
            imagePreview: [],
            ogImagePreview: null,
            thumbnailPreview: null,
            tagInput: "",
            colorInput: "",
          },
        ]);
      }
    } catch (error) {
      console.error("Submit error:", error);
      showApiError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderVariantForm = (formData: any, formIndex: number) => (
    <div key={formIndex} className="border border-gray-300 rounded-lg p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Variant {formIndex + 1}</h3>
        {variantForms.length > 1 && (
          <Button
            onClick={() => removeRow(formIndex)}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            <MdDelete size={25} />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Product */}
        <div className="flex flex-col">
          <Label>
            Select Product <span className="text-red-500">*</span>
          </Label>
          <SearchableSelect
            options={productOptions}
            placeholder="Select Product"
            value={formData.formData.product}
            onChange={(value: string) =>
              handleInputChange(formIndex, "product", value)
            }
          />
          {formData.errors.product && (
            <p className="text-red-500 text-sm">{formData.errors.product}</p>
          )}
        </div>

        {/* Variant Name */}
        <div className="flex flex-col">
          <Label>
            Variant Name <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            value={formData.formData.variantName}
            onChange={(e) =>
              handleInputChange(formIndex, "variantName", e.target.value)
            }
            placeholder="e.g. Blue Cotton Shirt - Large"
          />
          {formData.errors.variantName && (
            <p className="text-red-500 text-sm">
              {formData.errors.variantName}
            </p>
          )}
        </div>

        <div className="flex flex-col">
          <Label>
            Color<span className="text-red-500">*</span>
          </Label>
          <Input
            placeholder="e.g. Red, Blue, #FF0000"
            value={formData.formData.color || ""}
            onChange={(e) =>
              handleInputChange(formIndex, "color", e.target.value)
            }
          />
          {formData.errors.color && (
            <p className="text-red-500 text-sm mt-1">{formData.errors.color}</p>
          )}
        </div>

        {/* Size */}
        <div className="flex flex-col">
          <Label>Size</Label>
          <Input
            type="text"
            value={formData.formData.size || ""}
            onChange={(e) => handleInputChange(formIndex, "size", e.target.value)}
            placeholder="e.g. S, M, L or 42, 44"
          />
          {formData.errors.size && (
            <p className="text-red-500 text-sm mt-1">{formData.errors.size}</p>
          )}
        </div>


        {/* Row 2: Inventory & Base Price */}
        <div className="flex flex-col">
          <Label>Barcode <span className="text-red-500">*</span></Label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                ref={(el) => {
                  if (el) barcodeInputRefs.current.set(formIndex, el);
                  else barcodeInputRefs.current.delete(formIndex);
                }}
                type="text"
                value={formData.formData.barCode || ""}
                placeholder="Scan barcode or type manually…"
                autoComplete="off"
                className="pl-9"
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  handleInputChange(formIndex, "barCode", value);
                  if (value.length >= 6) handleInputChange(formIndex, "sku", value.slice(-6));
                }}
                onKeyDown={(e) => {
                  // Scanners terminate input with Enter — confirm the scan
                  // is complete instead of leaving focus mid-entry.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => focusBarcodeInput(formIndex)}
                title="Click to scan"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 transition-colors"
              >
                <MdOutlineQrCodeScanner size={16} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const code = Date.now().toString().substring(0, 13);
                handleInputChange(formIndex, "barCode", code);
                handleInputChange(formIndex, "sku", code.slice(-6));
              }}
              title="Generate random barcode"
              className="px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors h-11 flex items-center justify-center shadow-sm"
            >
              <FaBarcode className="text-xl" />
            </button>
          </div>
        </div>

        <div className="flex flex-col">
          <Label>SKU <span className="text-red-500">*</span></Label>
          <Input
            type="text"
            value={formData.formData.sku || ""}
            placeholder="e.g. AZU-SKU-01"
            onChange={(e) => handleInputChange(formIndex, "sku", e.target.value)}
          />
        </div>

        <div className="flex flex-col md:col-span-2">
          <Label>Stock Variant</Label>
          <Input
            type="number"
            disabled={isUpdate}
            value={
              isUpdate
                ? (initialStockInput === 0 ? "" : initialStockInput)
                : (formData.formData.stockVariant === 0 ? "" : (formData.formData.stockVariant || ""))
            }
            placeholder="e.g. 100"
            onChange={(e) => {
              const next = Number(e.target.value) || 0;
              if (isUpdate) {
                setInitialStockInput(next);
              } else {
                handleInputChange(formIndex, "stockVariant", next);
              }
            }}
          />
        </div>

        <div className="md:col-span-4">
          <Label>Specifications</Label>
          <div className="quill-container">
            <ReactQuill 
              theme="snow" 
              value={formData.formData.specifications || ""} 
              onChange={(content) => handleInputChange(formIndex, "specifications", content)}
              modules={quillModules}
              placeholder="Enter variant specifications..."
              className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
            />
          </div>
          {formData.errors.specifications && (
            <p className="text-red-500 text-sm mt-1">{formData.errors.specifications}</p>
          )}
        </div>

        {/* Pricing Sections - Following Product Form Sub-grid Pattern */}
        <div className="md:col-span-4 space-y-6">
          {/* Purchase Price Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="flex flex-col md:col-span-4">
              <Label>Purchase Price <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={formData.formData.purchasePrice === 0 ? "" : (formData.formData.purchasePrice || "")}
                placeholder="e.g. 600"
                onChange={(e) => handleInputChange(formIndex, "purchasePrice", Number(e.target.value) || 0)}
              />
              {formData.errors.purchasePrice && (
                <p className="text-red-500 text-sm mt-1">{formData.errors.purchasePrice}</p>
              )}
            </div>
          </div>

          {/* Retail Pricing Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
            <div>
              <Label>Retail Price Type</Label>
              <Select
                options={[
                  { value: "Percentage", label: "Percentage" },
                  { value: "TK", label: "TK" },
                ]}
                value={formData.selectedRetailType}
                onChange={(value) => handleRetailTypeChange(formIndex, value)}
              />
            </div>
            {formData.selectedRetailType === "Percentage" ? (
              <>
                <div>
                  <Label>Retail Value (%)</Label>
                  <Input
                    type="number"
                    value={formData.formData.retailProfitMarginByPercentage === 0 ? "" : (formData.formData.retailProfitMarginByPercentage || "")}
                    placeholder="10"
                    onChange={(e) => handleCustomInputChange(formIndex, "retailProfitMarginByPercentage", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Retail Price <span className="text-red-500">*</span></Label>
                  <Input
                    type="number"
                    value={formData.formData.retailPrice === 0 ? "" : (formData.formData.retailPrice || "")}
                    placeholder="e.g. 800"
                    onChange={(e) => handleInputChange(formIndex, "retailPrice", Number(e.target.value) || 0)}
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-3">
                <Label>Retail Price <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={formData.formData.retailPrice === 0 ? "" : (formData.formData.retailPrice || "")}
                  placeholder="e.g. 800"
                  onChange={(e) => handleInputChange(formIndex, "retailPrice", Number(e.target.value) || 0)}
                />
              </div>
            )}
          </div>

          {/* Wholesale Pricing Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
            <div>
              <Label>Wholesale Price Type</Label>
              <Select
                options={[
                  { value: "Percentage", label: "Percentage" },
                  { value: "TK", label: "TK" },
                ]}
                value={formData.selectedType}
                onChange={(value) => handleTypeChange(formIndex, value)}
              />
            </div>
            {formData.selectedType === "Percentage" ? (
              <>
                <div>
                  <Label>Wholesale Value (%)</Label>
                  <Input
                    type="number"
                    value={formData.formData.wholesaleProfitMarginPercentage === 0 ? "" : (formData.formData.wholesaleProfitMarginPercentage || "")}
                    placeholder="5"
                    onChange={(e) => handleCustomInputChange(formIndex, "wholesaleProfitMarginPercentage", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Wholesale Price</Label>
                  <Input
                    type="number"
                    value={formData.formData.wholesalePrice === 0 ? "" : (formData.formData.wholesalePrice || "")}
                    placeholder="e.g. 700"
                    onChange={(e) => handleInputChange(formIndex, "wholesalePrice", Number(e.target.value) || 0)}
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-3">
                <Label>Wholesale Price</Label>
                <Input
                  type="number"
                  value={formData.formData.wholesalePrice === 0 ? "" : (formData.formData.wholesalePrice || "")}
                  placeholder="e.g. 700"
                  onChange={(e) => handleInputChange(formIndex, "wholesalePrice", Number(e.target.value) || 0)}
                />
              </div>
            )}
          </div>

          {/* Inventory, Weight & Unit Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <Label>Alert Variant Stock</Label>
              <Input
                type="number"
                value={formData.formData.alertVariantStock === 0 ? "" : (formData.formData.alertVariantStock || "")}
                placeholder="e.g. 10"
                onChange={(e) => handleInputChange(formIndex, "alertVariantStock", Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Weight</Label>
              <Input
                type="number"
                value={formData.formData.weight === 0 ? "" : (formData.formData.weight || "")}
                placeholder="e.g. 0.5"
                onChange={(e) => handleInputChange(formIndex, "weight", Number(e.target.value) || 0)}
              />
              {formData.errors.weight && (
                <p className="text-red-500 text-sm mt-1">{formData.errors.weight}</p>
              )}
            </div>
            <div>
              <Label>Unit</Label>
              <Select
                options={[
                  { value: "Piece", label: "Piece" },
                  { value: "Kg", label: "Kg" },
                  { value: "Gram", label: "Gram" },
                  { value: "Packet", label: "Packet" },
                  { value: "pair", label: "Pair" },
                  { value: "liter", label: "Liter" },
                  { value: "Custom", label: "Custom" },
                ]}
                value={formData.formData.unit || ""}
                onChange={(value) => handleInputChange(formIndex, "unit", value)}
                onClear={() => handleInputChange(formIndex, "unit", "")}
              />
            </div>
            <div>
              <Label>Group Unit</Label>
              <Select
                options={[
                  { value: "Box", label: "Box" },
                  { value: "Dozen", label: "Dozen" },
                  { value: "Packet", label: "Packet" },
                ]}
                value={formData.formData.groupUnit || ""}
                onChange={(value) => handleInputChange(formIndex, "groupUnit", value)}
                onClear={() => handleInputChange(formIndex, "groupUnit", "")}
              />
            </div>
            <div>
              <Label>Group Qty</Label>
              <Input
                type="number"
                value={formData.formData.groupUnitQuantity === 0 ? "" : (formData.formData.groupUnitQuantity || "")}
                placeholder="e.g. 10"
                onChange={(e) => handleInputChange(formIndex, "groupUnitQuantity", Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dimensions & SEO */}
      <div className="mt-6 space-y-6">
        <SectionCard icon={<FaRulerCombined />} title="Dimensions">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div><Label>Width</Label><Input type="number" placeholder="10" value={formData.formData.dimensions?.width?.toString() || "0"} onChange={(e) => handleInputChange(formIndex, "dimensions", { ...formData.formData.dimensions, width: Number(e.target.value) || 0 })} /></div>
            <div><Label>Height</Label><Input type="number" placeholder="12" value={formData.formData.dimensions?.height?.toString() || "0"} onChange={(e) => handleInputChange(formIndex, "dimensions", { ...formData.formData.dimensions, height: Number(e.target.value) || 0 })} /></div>
            <div><Label>Depth</Label><Input type="number" placeholder="2" value={formData.formData.dimensions?.depth?.toString() || "0"} onChange={(e) => handleInputChange(formIndex, "dimensions", { ...formData.formData.dimensions, depth: Number(e.target.value) || 0 })} /></div>
          </div>
        </SectionCard>

        <SectionCard icon={<FaGlobe />} title="SEO">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2"><Label>Meta Title</Label><Input placeholder="Social Media Optimized Title" value={formData.formData.seo?.metaTitle || ""} onChange={(e) => handleInputChange(formIndex, "seo", { ...formData.formData.seo, metaTitle: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Focus Keyword</Label><Input placeholder="e.g. leather boots" value={formData.formData.seo?.focusKeyword || ""} onChange={(e) => handleInputChange(formIndex, "seo", { ...formData.formData.seo, focusKeyword: e.target.value })} /></div>
            <div className="md:col-span-2">
              <Label>Tags (Comma separated)</Label>
              <div className="flex gap-2 mt-1.5">
                <input type="text" value={formData.tagInput} onChange={(e) => setVariantForms(prev => prev.map((f, i) => i === formIndex ? { ...f, tagInput: e.target.value } : f))} className="flex-1 h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:border-brand-500 dark:focus:border-brand-400 transition-all dark:placeholder:text-white/60" placeholder="e.g. electronics, sale" />
                <button type="button" onClick={() => {
                  if (!formData.tagInput.trim()) return;
                  const newTags = formData.tagInput.split(",").map((t: string) => t.trim()).filter(Boolean);
                  const existingTags = formData.formData.seo?.metaKeywords || [];
                  const uniqueTags = Array.from(new Set([...existingTags, ...newTags]));
                  handleInputChange(formIndex, "seo", { ...formData.formData.seo, metaKeywords: uniqueTags });
                  setVariantForms(prev => prev.map((f, i) => i === formIndex ? { ...f, tagInput: "" } : f));
                }} className="bg-brand-500 text-white px-6 rounded-xl font-bold uppercase text-[10px] hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">Apply Tags</button>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.formData.seo?.metaKeywords?.map((tag: string, tagIdx: number) => (
                  <span key={tagIdx} className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400`}>
                    #{tag}
                    <button type="button" onClick={() => {
                      const updatedTags = formData.formData.seo?.metaKeywords.filter((_: any, i: number) => i !== tagIdx);
                      handleInputChange(formIndex, "seo", { ...formData.formData.seo, metaKeywords: updatedTags });
                    }} className="hover:text-red-500 transition-colors bg-white/50 dark:bg-black/20 rounded-full p-0.5"><FaTrashAlt className="size-2.5" /></button>
                  </span>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Meta Description</Label>
              <div className="quill-container">
                <ReactQuill theme="snow" value={formData.formData.seo?.metaDescription || ""} onChange={(c) => handleInputChange(formIndex, "seo", { ...formData.formData.seo, metaDescription: c })} modules={quillModules} className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden" />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label>OG Title</Label>
              <Input
                type="text"
                value={formData.formData.seo?.ogTitle || ""}
                onChange={(e) => handleInputChange(formIndex, "seo", { ...formData.formData.seo, ogTitle: e.target.value })}
                placeholder="Social media share title"
              />
            </div>

            <div className="md:col-span-2">
              <Label>OG Description</Label>
              <div className="quill-container">
                <ReactQuill theme="snow" value={formData.formData.seo?.ogDescription || ""} onChange={(c) => handleInputChange(formIndex, "seo", { ...formData.formData.seo, ogDescription: c })} modules={quillModules} className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden" />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard icon={<FaCloudUploadAlt />} title="Images">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Main Image Upload (Multi) */}
            <div className="flex flex-col">
              <Label>
                Upload Images <span className="text-red-500">*</span>
              </Label>
              {isUpdate ? (
                <div>
                  <div className="flex justify-between items-center w-full mb-3">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Gallery Control</span>
                    {selectedImages.length > 0 && (
                      <Button 
                        size="sm" 
                          className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] text-[10px] py-1 px-3 rounded-lg flex items-center gap-1.5 shadow-lg active:scale-95"
                        onClick={handleDeleteGalleryImages}
                        disabled={isDeletingImages}
                      >
                        {isDeletingImages ? <FaSync className="animate-spin" /> : <FaTrashAlt className="size-2.5" />}
                        Delete Selected ({selectedImages.length})
                      </Button>
                    )}
                  </div>
                  
                  <GalleryDropZone onDrop={onGalleryDrop} galleryCount={gallery.length + existingGallery.length} />
                  
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {existingGallery.map((img, i) => (
                      <div 
                        key={`exist-${i}`} 
                        className={`relative aspect-square rounded-xl overflow-hidden border group shadow-sm transition-all cursor-zoom-in ${
                          selectedImages.includes(img.publicId) ? "ring-2 ring-red-500 border-red-500" : "border-gray-200 hover:border-brand-400 dark:border-gray-800"
                        }`}
                      >
                        <img src={img.url} className={`w-full h-full object-cover transition-all ${selectedImages.includes(img.publicId) ? "opacity-40" : "opacity-80 group-hover:opacity-100 group-hover:scale-110"}`} alt="existing" />
                        
                        {/* Multi-select Checkbox */}
                        <div className="absolute top-1.5 right-1.5 z-10">
                          <input 
                            type="checkbox" 
                            checked={selectedImages.includes(img.publicId)}
                            onChange={(e) => { e.stopPropagation(); toggleImageSelection(img.publicId); }}
                            className="size-4 rounded-md border-gray-300 text-red-500 focus:ring-red-500 cursor-pointer accent-red-500"
                          />
                        </div>

                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleImageSelection(img.publicId); }} 
                            className={`p-2 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300 duration-300 ${
                              selectedImages.includes(img.publicId) ? "bg-red-500 text-white" : "bg-white text-gray-700 hover:bg-red-500 hover:text-white"
                            }`}
                          >
                            {selectedImages.includes(img.publicId) ? <FaTimesCircle className="size-3" /> : <FaTrashAlt className="size-3" />}
                          </button>
                        </div>
                        
                        {!selectedImages.includes(img.publicId) && (
                          <div className="absolute bottom-1 left-1 bg-blue-500/90 text-[8px] text-white px-1.5 py-0.5 rounded-md font-bold uppercase backdrop-blur-sm">Stored</div>
                        )}
                      </div>
                    ))}
                    {galleryPreviews.map((u, i) => (
                      <div 
                        key={`new-${i}`} 
                        className="relative aspect-square rounded-xl overflow-hidden border border-emerald-200 group shadow-sm bg-emerald-50/10 cursor-zoom-in"
                      >
                        <img src={u} className="w-full h-full object-cover transition-all group-hover:scale-110" alt="new" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeNewGalleryImage(i); }} className="bg-red-500 text-white p-2 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300"><FaTrashAlt className="size-3" /></button>
                        </div>
                        <div className="absolute top-1 left-1 bg-emerald-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-bold uppercase shadow-sm">New</div>
                      </div>
                    ))}
                  </div>

                  {gallery.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <Button 
                        className="w-full bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] text-xs font-black py-3 rounded-xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all animate-pulse"
                        onClick={handleAddExtraImages}
                        disabled={isUploadingImages}
                      >
                        {isUploadingImages ? <FaSync className="animate-spin text-lg" /> : <FaCloudUploadAlt className="text-lg" />}
                        UPLOAD & ADD NEW IMAGES
                      </Button>
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold text-center uppercase tracking-wider">Please upload new images before updating variant</p>
                    </div>
                  )}
                </div>
              ) : (
                <MultiImageZone 
                  images={formData.imagePreview}
                  onDrop={(files: File[]) => {
                    const currentImages = formData.formData.image || [];
                    const currentPreviews = formData.imagePreview || [];
                    
                    if (currentImages.length + files.length > 10) {
                      toast.error("Maximum 10 images allowed per variant");
                      return;
                    }

                    const newImages = [...currentImages, ...files];
                    const newPreviews = [...currentPreviews, ...files.map(f => URL.createObjectURL(f))];
                    
                    handleInputChange(formIndex, "image", newImages);
                    setVariantForms((prev) =>
                      prev.map((f, i) => i === formIndex ? { ...f, imagePreview: newPreviews } : f)
                    );
                  }}
                  onRemove={(idx: number) => {
                    const newImages = formData.formData.image?.filter((_: any, i: number) => i !== idx);
                    const newPreviews = formData.imagePreview?.filter((_: any, i: number) => i !== idx);
                    
                    handleInputChange(formIndex, "image", newImages);
                    setVariantForms((prev) =>
                      prev.map((f, i) => i === formIndex ? { ...f, imagePreview: newPreviews } : f)
                    );
                  }}
                  label="Upload Variant Images (Max 10)"
                />
              )}
              {formData.errors.image && (
                <p className="text-red-500 text-sm mt-1">{formData.errors.image}</p>
              )}
            </div>

            {/* Thumbnail Upload */}
            <div className="flex flex-col">
              <Label>Upload Thumbnail</Label>
              <DropZone 
                onDrop={(files: File[]) => {
                  if (files[0]) {
                    handleInputChange(formIndex, "thumbnail", files[0]);
                    setVariantForms((prev) =>
                      prev.map((f, i) => i === formIndex ? { ...f, thumbnailPreview: URL.createObjectURL(files[0]) } : f)
                    );
                  }
                }} 
                preview={formData.thumbnailPreview} 
                onRemove={() => { 
                  handleInputChange(formIndex, "thumbnail", null);
                  setVariantForms((prev) =>
                    prev.map((f, i) => i === formIndex ? { ...f, thumbnailPreview: null } : f)
                  );
                }} 
                label="Upload Thumbnail Image" 
                height="py-6"
              />
            </div>

            {/* OG Image Upload */}
            <div className="flex flex-col md:col-span-2">
              <Label>Upload OG Image</Label>
              <DropZone 
                onDrop={(files: File[]) => {
                  if (files[0]) {
                    handleInputChange(formIndex, "ogImage", files[0]);
                    setVariantForms((prev) =>
                      prev.map((f, i) => i === formIndex ? { ...f, ogImagePreview: URL.createObjectURL(files[0]) } : f)
                    );
                  }
                }} 
                preview={formData.ogImagePreview} 
                onRemove={() => { 
                  handleInputChange(formIndex, "ogImage", null);
                  setVariantForms((prev) =>
                    prev.map((f, i) => i === formIndex ? { ...f, ogImagePreview: null } : f)
                  );
                }} 
                label="Upload Social Preview Image" 
                height="py-6"
              />
            </div>
          </div>
        </SectionCard>
        <style>{`.ql-editor { min-height: 200px; }`}</style>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {variantForms.map((formData, index) =>
        renderVariantForm(formData, index)
      )}

      {!isUpdate && (
        <div className="flex gap-4 w-full ">
          <button
            onClick={addNewRow}
              className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] font-bold px-4 py-2 rounded w-full"
            disabled={isLoading}
          >
            Add New Variant
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleSubmit}
            className={`px-6 py-3 rounded-xl text-[#1D4ED8] font-bold transition-all uppercase tracking-wider text-xs ${
            isUpdate && (gallery.length > 0 || selectedImages.length > 0)
              ? "bg-[#EEF4FF] text-[#9DB2E8] cursor-not-allowed"
              : "bg-[#DCE8FF] hover:bg-[#C7DAFF] active:scale-95"
          }`}
          disabled={isLoading || (isUpdate && (gallery.length > 0 || selectedImages.length > 0))}
        >
          {isLoading
            ? isUpdate
              ? "Updating..."
              : "Creating..."
            : isUpdate
            ? "Update Variant"
            : "Create Variants"}
        </Button>

        {isUpdate && (
          <Button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
              className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-xs shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <FaSync className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
        )}
      </div>
      {isUpdate && (gallery.length > 0 || selectedImages.length > 0) && (
        <p className="text-[10px] text-red-500 font-bold mt-2 uppercase tracking-wider">
          Please complete uploading new images or deleting selected stored images before updating the variant details
        </p>
      )}
    </div>
  );
};

export default CreateVariantForm;
