import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { FaTrashAlt, FaCloudUploadAlt, FaSync, FaInfoCircle, FaCubes, FaGlobe, FaSearchPlus, FaBarcode, FaTimesCircle, FaRulerCombined } from "react-icons/fa";
import { MdOutlineQrCodeScanner } from "react-icons/md";
import axiosSecure from "../../hooks/useAxiosSecure";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import Select from "../form/Select";
import SearchableSelect from "../form/SearchableSelect";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { showApiError } from "../../utils/apiError";
import { scopedStorageKey } from "../../lib/session";

// Interfaces
interface Category { _id: string; name: string; slug: string; }
interface SubCategory { _id: string; name: string; category: { _id: string } | string; }
interface Brand { _id: string; name: string; }

interface SEOData {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  focusKeyword: string;
  ogTitle: string;
  ogDescription: string;
}

interface Dimensions { width: string; height: string; depth: string; }

interface FormValues {
  name: string;
  description: string;
  category: string;
  subcategory: string;
  brand: string;
  variantType: "singleVariant" | "multipleVariant";
  sku: string;
  barCode: string;
  stock: string;
  alertQuantity: string;
  purchasePrice: string;
  retailPrice: string;
  wholesalePrice: string;
  size: string;
  color: string;
  weight: string;
  dimensions: Dimensions;
  unit: string;
  groupUnit: string;
  groupUnitQuantity: string;
  tag: string;
  specifications: string;
  manufactureCountry: string;
  warrantyInformation: string;
  shippingInformation: string;
  warehouseLocation: string;
  availabilityStatus: string;
  rating: string;
  seo: SEOData;
  retailProfitMarginbyPercentance: string;
  retailProfitMarginbyAmount: string;
  wholesaleProfitMarginPercentage: string;
  wholesaleProfitMarginAmount: string;
}

interface ValidationErrors { [key: string]: string; }

const tagColors = [
  "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400",
  "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400",
  "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400",
];

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, false] }],
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link", "clean"],
  ],
};

// --- HELPER COMPONENTS ---
const RequiredAsterisk = () => <span className="text-red-500 ml-0.5 font-bold">*</span>;

const SectionCard = ({ icon, title, children, className = "" }: any) => (
  <div className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm overflow-hidden ${className}`}>
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
      <div className="flex items-center justify-center size-8 rounded-xl bg-brand-50 dark:bg-brand-500/10 text-brand-500">{icon}</div>
      <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider">{title}</h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const FieldError = ({ msg }: { msg?: string }) => msg ? <p className="text-red-500 text-[10px] mt-1 font-semibold flex items-center gap-1">⚠ {msg}</p> : null;

const DropZone = ({ onDrop, multiple = false, preview, onRemove, label, height = "py-8" }: any) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple, accept: { "image/*": [] }, maxSize: 5 * 1024 * 1024 });
  return (
    <div {...getRootProps()} className={`relative mt-1.5 flex flex-col items-center justify-center w-full border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 ${isDragActive ? "border-brand-500 bg-brand-50" : "border-gray-200 dark:border-gray-700 hover:border-brand-400"} ${preview ? "border-none p-0" : height + " px-6"}`}>
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

// --- IndexedDB Helpers for Product Draft Files ---
const DB_NAME = "ProductDraftDB";
const STORE_NAME = "product_draft_files";

// The record key is namespaced per store: one IndexedDB database serves the
// whole browser, so an unscoped key would restore one store's draft images
// into the next store signed in on the same machine.
const productDraftFilesKey = () => scopedStorageKey("product_draft_files_key");

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

const saveProductDraftFiles = async (
  filesMap: { gallery: File[]; thumbnail: File | null; ogImage: File | null }
) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(filesMap, productDraftFilesKey());
  } catch (e) {
    console.error("Failed to save product files to IndexedDB", e);
  }
};

const getProductDraftFiles = async (): Promise<
  { gallery: File[]; thumbnail: File | null; ogImage: File | null } | null
> => {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(productDraftFilesKey());
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error("Failed to get product files from IndexedDB", e);
    return null;
  }
};

const clearProductDraftFiles = async () => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(productDraftFilesKey());
  } catch (e) {
    console.error("Failed to clear product IndexedDB files", e);
  }
};

// --- MAIN COMPONENT ---
const CreateProductForm = () => {
  const initialFormValues: FormValues = {
    name: "", description: "", category: "", subcategory: "", brand: "", variantType: "singleVariant",
    sku: "", barCode: "", stock: "", alertQuantity: "", purchasePrice: "", retailPrice: "", wholesalePrice: "",
    size: "", color: "", weight: "", dimensions: { width: "", height: "", depth: "" },
    unit: "", groupUnit: "", groupUnitQuantity: "", tag: "", specifications: "",
    manufactureCountry: "", warrantyInformation: "", shippingInformation: "", warehouseLocation: "",
    availabilityStatus: "In Stock", rating: "0",
    seo: {
      metaTitle: "", metaDescription: "", metaKeywords: "", focusKeyword: "",
      ogTitle: "", ogDescription: "",
    },
    retailProfitMarginbyPercentance: "",
    retailProfitMarginbyAmount: "",
    wholesaleProfitMarginPercentage: "",
    wholesaleProfitMarginAmount: "",
  };

  const [categories, setCategories] = useState<Category[]>([]);
  const [dynamicSubCategories, setDynamicSubCategories] = useState<SubCategory[]>([]);
  const [isFetchingSubCats, setIsFetchingSubCats] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [tagInput, setTagInput] = useState("");
  const [metaKeywordInput, setMetaKeywordInput] = useState("");

  // Barcode scanner — a USB scanner just types into whatever has focus, so
  // clicking the scanner icon focuses this field for a fast scan.
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const focusBarcodeInput = () => barcodeInputRef.current?.focus();

  const [retailMarginType, setRetailMarginType] = useState<"Percentage" | "TK">((() => {
    try {
      const savedDraft = localStorage.getItem(scopedStorageKey("product_form_draft"));
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && parsed.retailMarginType) {
          return parsed.retailMarginType;
        }
      }
    } catch {}
    return "TK";
  })());

  const [wholesaleMarginType, setWholesaleMarginType] = useState<"Percentage" | "TK">((() => {
    try {
      const savedDraft = localStorage.getItem(scopedStorageKey("product_form_draft"));
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && parsed.wholesaleMarginType) {
          return parsed.wholesaleMarginType;
        }
      }
    } catch {}
    return "TK";
  })());

  const queryClient = useQueryClient();

  const createProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await axiosSecure.post("/product/createproduct", data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Product Created Successfully!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setFormData(initialFormValues);
      setThumbnail(null);
      setThumbnailPreview(null);
      setGallery([]);
      setGalleryPreviews([]);
      setOgImage(null);
      setOgImagePreview(null);
      setTagInput("");
      setMetaKeywordInput("");
      localStorage.removeItem(scopedStorageKey("product_form_draft"));
      clearProductDraftFiles();
    },
    onError: (error: any) => {
      showApiError(error, "Submission failed.");
    },
  });

  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [ogImage, setOgImage] = useState<File | null>(null);
  const [ogImagePreview, setOgImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormValues>(() => {
    try {
      const savedDraft = localStorage.getItem(scopedStorageKey("product_form_draft"));
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && parsed.formData) {
          return {
            ...initialFormValues,
            ...parsed.formData,
          };
        }
      }
    } catch (e) {
      console.error("Failed to load product draft from localStorage", e);
    }
    return initialFormValues;
  });

  // --- Draft Persistence Logic ---
  const isRestored = useRef(false);

  // Restore draft files and recreate preview URLs on mount
  useEffect(() => {
    const restoreFiles = async () => {
      try {
        const savedFiles = await getProductDraftFiles();
        if (savedFiles) {
          if (savedFiles.thumbnail) {
            setThumbnail(savedFiles.thumbnail);
            setThumbnailPreview(URL.createObjectURL(savedFiles.thumbnail));
          }
          if (savedFiles.ogImage) {
            setOgImage(savedFiles.ogImage);
            setOgImagePreview(URL.createObjectURL(savedFiles.ogImage));
          }
          if (savedFiles.gallery && savedFiles.gallery.length > 0) {
            setGallery(savedFiles.gallery);
            setGalleryPreviews(
              savedFiles.gallery.map((file) => URL.createObjectURL(file))
            );
          }
        }
      } catch (e) {
        console.error("Failed to restore product files from IndexedDB", e);
      } finally {
        isRestored.current = true;
      }
    };
    restoreFiles();
  }, []);

  // Save draft text and margin types to localStorage and files to IndexedDB (after restoring is complete)
  useEffect(() => {
    if (isRestored.current) {
      // Save text fields and margin types to localStorage
      const draftToSave = {
        formData,
        retailMarginType,
        wholesaleMarginType,
      };
      localStorage.setItem(scopedStorageKey("product_form_draft"), JSON.stringify(draftToSave));

      // Save files to IndexedDB
      saveProductDraftFiles({
        gallery,
        thumbnail,
        ogImage,
      });
    }
  }, [formData, retailMarginType, wholesaleMarginType, gallery, thumbnail, ogImage]);

  // Load subcategories if category exists in restored draft
  useEffect(() => {
    if (categories.length > 0 && formData.category && dynamicSubCategories.length === 0) {
      const selectedCategory = categories.find(c => c._id === formData.category);
      if (selectedCategory?.slug) {
        const fetchSubCats = async () => {
          setIsFetchingSubCats(true);
          try {
            const res = await axiosSecure.get(`/categories/${selectedCategory.slug}`);
            setDynamicSubCategories(res?.data?.data?.category?.subcategories || []);
          } catch {
            console.error("Failed to load subcategories for category draft");
          } finally {
            setIsFetchingSubCats(false);
          }
        };
        fetchSubCats();
      }
    }
  }, [categories, formData.category]);

  // Manage and clean up Object URLs to prevent memory leaks
  const prevUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentUrls = new Set<string>();

    if (thumbnailPreview && thumbnailPreview.startsWith("blob:")) {
      currentUrls.add(thumbnailPreview);
    }
    if (ogImagePreview && ogImagePreview.startsWith("blob:")) {
      currentUrls.add(ogImagePreview);
    }
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
  }, [thumbnailPreview, ogImagePreview, galleryPreviews]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([axiosSecure.get("/categories"), axiosSecure.get("/brand")]);
        setCategories(catRes?.data?.data?.categories || []);
        setBrands(brandRes?.data?.data?.brands || []);
      } catch (error) { showApiError(error, "Failed to load initial data."); }
    };
    fetchData();
  }, []);
  
  useEffect(() => {
    const purchase = parseFloat(formData.purchasePrice);
    if (isNaN(purchase)) return;

    setFormData(p => {
      let updates: any = {};

      // Retail calculation
      if (retailMarginType === "Percentage" && p.retailProfitMarginbyPercentance) {
        const val = parseFloat(p.retailProfitMarginbyPercentance);
        updates.retailPrice = Math.round(purchase + (purchase * val / 100)).toString();
      }

      // Wholesale calculation
      if (wholesaleMarginType === "Percentage" && p.wholesaleProfitMarginPercentage) {
        const val = parseFloat(p.wholesaleProfitMarginPercentage);
        updates.wholesalePrice = Math.round(purchase + (purchase * val / 100)).toString();
      }

      if (Object.keys(updates).length === 0) return p;

      // Check if anything actually changed
      const isChanged = Object.keys(updates).some(k => p[k as keyof FormValues] !== updates[k]);
      if (!isChanged) return p;

      return { ...p, ...updates };
    });
  }, [
    formData.purchasePrice,
    formData.retailProfitMarginbyPercentance,
    formData.retailProfitMarginbyAmount,
    formData.wholesaleProfitMarginPercentage,
    formData.wholesaleProfitMarginAmount,
    retailMarginType,
    wholesaleMarginType
  ]);

  const handleCategoryChange = async (categoryId: string) => {
    setFormData(p => ({ ...p, category: categoryId, subcategory: "" }));
    setDynamicSubCategories([]);
    if (!categoryId) return;
    const selectedCategory = categories.find(c => c._id === categoryId);
    if (!selectedCategory?.slug) return;
    setIsFetchingSubCats(true);
    try {
      const res = await axiosSecure.get(`/categories/${selectedCategory.slug}`);
      setDynamicSubCategories(res?.data?.data?.category?.subcategories || []);
    } catch (error) { showApiError(error, "Failed to load subcategories."); }
    finally { setIsFetchingSubCats(false); }
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    
    // Numeric Validation Logic
    const numFields = [
      "stock", "purchasePrice", "retailPrice", "wholesalePrice", "alertQuantity", "weight", 
      "groupUnitQuantity", "rating", "retailProfitMarginbyPercentance", "retailProfitMarginbyAmount",
      "wholesaleProfitMarginPercentage", "wholesaleProfitMarginAmount"
    ];
    if (name === "barCode") {
      const clean = value.replace(/[^0-9]/g, "");
      setFormData(p => ({ ...p, barCode: clean, sku: clean.slice(-6) }));
      return;
    }

    if (numFields.includes(name) || name.startsWith("dimensions.")) {
      const clean = value.replace(/[^0-9.]/g, "");
      const parts = clean.split(".");
      let formattedVal = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : clean;
      
      // Remove leading zeros but allow "0" or "0."
      if (formattedVal.length > 1 && formattedVal.startsWith("0") && formattedVal[1] !== ".") {
        formattedVal = formattedVal.replace(/^0+/, "");
      }
      
      if (name.startsWith("dimensions.")) {
        const field = name.split(".")[1];
        setFormData(p => ({ ...p, dimensions: { ...p.dimensions, [field]: formattedVal } }));
      } else {
        setFormData(p => ({ ...p, [name]: formattedVal }));
      }
      if (errors[name]) setErrors(p => ({ ...p, [name]: "" }));
      return;
    }

    if (name.startsWith("seo.")) {
      const field = name.split(".")[1];
      setFormData(p => ({ ...p, seo: { ...p.seo, [field]: value } }));
    } else {
      setFormData(p => ({ ...p, [name]: value }));
    }
    if (errors[name]) setErrors(p => ({ ...p, [name]: "" }));
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const onThumbnailDrop = useCallback((f: File[]) => { if(f[0]) { setThumbnail(f[0]); setThumbnailPreview(URL.createObjectURL(f[0])); } }, []);
  const onOgImageDrop = useCallback((f: File[]) => { if(f[0]) { setOgImage(f[0]); setOgImagePreview(URL.createObjectURL(f[0])); } }, []);
  const onGalleryDrop = useCallback((f: File[]) => {
    const remaining = 10 - gallery.length;
    if (remaining <= 0) { toast.error("Max 10 images"); return; }
    const newFiles = f.slice(0, remaining);
    setGallery(p => [...p, ...newFiles]);
    setGalleryPreviews(p => [...p, ...newFiles.map(file => URL.createObjectURL(file))]);
  }, [gallery]);

  const removeGalleryImage = (i: number) => {
    setGallery(p => p.filter((_, idx) => idx !== i));
    setGalleryPreviews(p => p.filter((_, idx) => idx !== i));
  };

  const generateBarcode = () => {
    const code = Date.now().toString().substring(0, 13);
    setFormData(p => ({ ...p, barCode: code, sku: code.slice(-6) }));
  };
  
  const applyTags = () => { setFormData(p => ({ ...p, tag: tagInput })); setTagInput(""); };
  const removeTag = (t: string) => {
    const updated = formData.tag.split(",").map(x => x.trim()).filter(x => x && x !== t.trim()).join(", ");
    setFormData(p => ({ ...p, tag: updated }));
  };

  const applyMetaKeywords = () => { setFormData(p => ({ ...p, seo: { ...p.seo, metaKeywords: metaKeywordInput } })); setMetaKeywordInput(""); };
  const removeMetaKeyword = (k: string) => {
    const updated = formData.seo.metaKeywords.split(",").map(x => x.trim()).filter(x => x && x !== k.trim()).join(", ");
    setFormData(p => ({ ...p, seo: { ...p.seo, metaKeywords: updated } }));
  };

  const handleSubmit = async () => {
    const newErrors: ValidationErrors = {};
    const isMultiple = formData.variantType === "multipleVariant";

    if (!thumbnail && !isMultiple) newErrors.thumbnail = "Thumbnail is required";
    if (gallery.length === 0 && !isMultiple) newErrors.gallery = "At least one gallery image is required";
    if (!formData.unit && !isMultiple) newErrors.unit = "Unit is required";
    
    const hasSpecText = formData.specifications && formData.specifications.replace(/<[^>]*>/g, "").trim().length > 0;
    if (!hasSpecText && !isMultiple) newErrors.specifications = "Specifications is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const data = new FormData();
    
    const appendToFormData = (key: string, value: any) => {
      if (value === "" || value === null || value === undefined) return;
      
      if (key === "seo" || key === "dimensions") {
        Object.entries(value).forEach(([subK, subV]) => {
          if (subV !== "" && subV !== null && subV !== undefined) {
            if (subK === "metaKeywords") {
              // Handle SEO keywords as an array using [] notation
              const keywords = subV.toString().split(",").map((x: string) => x.trim()).filter(Boolean);
              keywords.forEach((k: string) => data.append(`${key}[${subK}][]`, k));
            } else {
              data.append(`${key}[${subK}]`, subV.toString());
            }
          }
        });
      } else if (key === "tag") {
        // Handle tags as an array using [] notation
        const tags = value.toString().split(",").map((x: string) => x.trim()).filter(Boolean);
        tags.forEach((t: string) => data.append("tag[]", t));
      } else {
        data.append(key, value.toString());
      }
    };

    if (isMultiple) {
      // For Multiple Variant, only send Core Identity fields + Metadata
      const coreFields = ["name", "description", "category", "subcategory", "brand", "variantType", "seo", "tag"];
      coreFields.forEach(key => {
        appendToFormData(key, formData[key as keyof FormValues]);
      });
    } else {
      // For Single Variant, send all fields
      Object.entries(formData).forEach(([k, v]) => {
        appendToFormData(k, v);
      });
    }

    if (!isMultiple) {
      if (thumbnail) data.append("thumbnail", thumbnail);
      if (ogImage) data.append("ogImage", ogImage);
      gallery.forEach(f => data.append("image", f));
    }

    createProductMutation.mutate(data);
  };

  const isMultiple = formData.variantType === "multipleVariant";
  const blurClass = isMultiple ? "opacity-40 pointer-events-none blur-[1.5px] grayscale-[50%] transition-all duration-500" : "transition-all duration-500";

  return (
    <div className="space-y-6 pb-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          <SectionCard icon={<FaInfoCircle />} title="Core Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2"><Label>Product Name<RequiredAsterisk /></Label><Input name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. Nike Air Max" /></div>
              <div><Label>Category<RequiredAsterisk /></Label><SearchableSelect options={categories.map(c => ({ value: c._id, label: c.name }))} value={formData.category} onChange={handleCategoryChange} /></div>
              <div><Label>Subcategory<RequiredAsterisk /></Label><SearchableSelect options={dynamicSubCategories.map(s => ({ value: s._id, label: s.name }))} value={formData.subcategory} onChange={(v) => setFormData(p => ({ ...p, subcategory: v }))} placeholder={isFetchingSubCats ? "Loading..." : "Select Subcategory"} /></div>
              <div><Label>Brand<RequiredAsterisk /></Label><SearchableSelect options={brands.map(b => ({ value: b._id, label: b.name }))} value={formData.brand} onChange={(v) => setFormData(p => ({ ...p, brand: v }))} /></div>
              <div><Label>Variant Type<RequiredAsterisk /></Label><Select options={[{value:"singleVariant", label:"Single Variant"}, {value:"multipleVariant", label:"Multiple Variant"}]} value={formData.variantType} onChange={(v) => setFormData(p => ({...p, variantType: v as any}))} /></div>
              <div className="md:col-span-2"><Label>Description</Label><div className="quill-container"><ReactQuill theme="snow" value={formData.description} onChange={(c) => setFormData(p=>({...p, description:c}))} modules={quillModules} className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden" /><style>{`.ql-editor { min-height: 200px; }`}</style></div></div>
            </div>
          </SectionCard>

          {!isMultiple && (
            <SectionCard icon={<FaCubes />} title="Pricing & Inventory">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-8 items-end">
                <div className="md:col-span-4">
                  <Label>Barcode<RequiredAsterisk /></Label>
                  <div className="relative">
                    <Input
                      ref={barcodeInputRef}
                      name="barCode"
                      value={formData.barCode}
                      onChange={handleInputChange}
                      onKeyDown={(e) => {
                        // Scanners terminate input with Enter — confirm the
                        // scan is complete instead of leaving focus mid-entry.
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      autoComplete="off"
                      className="pl-9"
                      placeholder="Scan barcode or type manually…"
                    />
                    <button
                      type="button"
                      onClick={focusBarcodeInput}
                      title="Click to scan"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-500 transition-colors"
                    >
                      <MdOutlineQrCodeScanner size={16} />
                    </button>
                  </div>
                </div>
                <div className="md:col-span-1">
                  <button type="button" onClick={generateBarcode} className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 transition-all flex items-center justify-center shadow-sm group">
                    <FaBarcode className="text-white text-xl group-hover:scale-110 transition-transform" />
                  </button>
                </div>
                <div className="md:col-span-4"><Label>SKU<RequiredAsterisk /></Label><Input name="sku" value={formData.sku} onChange={handleInputChange} placeholder="e.g. AZU-TEW-14" /></div>
                <div className="md:col-span-3"><Label>Stock</Label><Input type="number" name="stock" value={formData.stock === "0" ? "" : formData.stock} onChange={handleInputChange} placeholder="e.g. 50" /></div>
                <div className="md:col-span-12"><Label>Purchase Price<RequiredAsterisk /></Label><Input type="number" name="purchasePrice" value={formData.purchasePrice === "0" ? "" : formData.purchasePrice} onChange={handleInputChange} placeholder="e.g. 600" /></div>
              </div>

              <div className="space-y-5">
                {/* Retail Pricing Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
                  <div>
                    <Label>Retail Price Type</Label>
                    <Select options={[{value:"Percentage", label:"Percentage"}, {value:"TK", label:"TK"}]} value={retailMarginType} onChange={(v)=>setRetailMarginType(v as any)} />
                  </div>
                  {retailMarginType === "Percentage" ? (
                    <>
                      <div>
                        <Label>Retail Value (%)</Label>
                        <Input name="retailProfitMarginbyPercentance" value={formData.retailProfitMarginbyPercentance === "0" ? "" : formData.retailProfitMarginbyPercentance} onChange={handleInputChange} placeholder="10" />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Retail Price<RequiredAsterisk /></Label>
                        <Input type="number" name="retailPrice" value={formData.retailPrice === "0" ? "" : formData.retailPrice} onChange={handleInputChange} placeholder="e.g. 800" />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-3">
                      <Label>Retail Price<RequiredAsterisk /></Label>
                      <Input type="number" name="retailPrice" value={formData.retailPrice === "0" ? "" : formData.retailPrice} onChange={handleInputChange} placeholder="e.g. 800" />
                    </div>
                  )}
                </div>

                {/* Wholesale Pricing Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
                  <div>
                    <Label>Wholesale Price Type</Label>
                    <Select options={[{value:"Percentage", label:"Percentage"}, {value:"TK", label:"TK"}]} value={wholesaleMarginType} onChange={(v)=>setWholesaleMarginType(v as any)} />
                  </div>
                  {wholesaleMarginType === "Percentage" ? (
                    <>
                      <div>
                        <Label>Wholesale Value (%)</Label>
                        <Input name="wholesaleProfitMarginPercentage" value={formData.wholesaleProfitMarginPercentage === "0" ? "" : formData.wholesaleProfitMarginPercentage} onChange={handleInputChange} placeholder="5" />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Wholesale Price</Label>
                        <Input type="number" name="wholesalePrice" value={formData.wholesalePrice === "0" ? "" : formData.wholesalePrice} onChange={handleInputChange} placeholder="e.g. 700" />
                      </div>
                    </>
                  ) : (
                    <div className="md:col-span-3">
                      <Label>Wholesale Price</Label>
                      <Input type="number" name="wholesalePrice" value={formData.wholesalePrice === "0" ? "" : formData.wholesalePrice} onChange={handleInputChange} placeholder="e.g. 700" />
                    </div>
                  )}
                </div>

                {/* Alert Quantity Row */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                  <div className="md:col-span-4">
                    <Label>Alert Variant Stock<RequiredAsterisk /></Label>
                    <Input type="number" name="alertQuantity" value={formData.alertQuantity === "0" ? "" : formData.alertQuantity} onChange={handleInputChange} placeholder="e.g. 5" />
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          <div className={blurClass}>
            <SectionCard icon={<FaRulerCombined />} title="Attributes & Logistics">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div><Label>Size</Label><Input name="size" value={formData.size} onChange={handleInputChange} placeholder="XL, 42, etc" /><FieldError msg={errors.size} /></div>
                <div><Label>Color<RequiredAsterisk /></Label><Input name="color" value={formData.color} onChange={handleInputChange} placeholder="Red, Blue" /><FieldError msg={errors.color} /></div>
                <div><Label>Product Weight<RequiredAsterisk /></Label><Input type="number" name="weight" value={formData.weight} onChange={handleInputChange} onKeyDown={(e) => !/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.preventDefault()} placeholder="e.g. 0.5 kg" /><FieldError msg={errors.weight} /></div>
                <div><Label>Unit<RequiredAsterisk /></Label><Select options={[{value:"Piece", label:"Piece"}, {value:"Kg", label:"Kg"}, {value:"Gram", label:"Gram"}, {value:"Packet", label:"Packet"}]} value={formData.unit} onChange={(v)=>setFormData(p=>({...p, unit:v}))} onClear={()=>setFormData(p=>({...p, unit:""}))} /><FieldError msg={errors.unit} /></div>
                <div><Label>Group Unit</Label><Select options={[{value:"Box", label:"Box"}, {value:"Dozen", label:"Dozen"}, {value:"Packet", label:"Packet"}]} value={formData.groupUnit} onChange={(v)=>setFormData(p=>({...p, groupUnit:v}))} onClear={()=>setFormData(p=>({...p, groupUnit:""}))} /></div>
                <div><Label>Group Qty</Label><Input type="number" name="groupUnitQuantity" value={formData.groupUnitQuantity} onChange={handleInputChange} onKeyDown={(e) => !/[0-9.]/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.preventDefault()} placeholder="e.g. 10" /></div>
                
                <div className="md:col-span-3">
                  <Label>Specifications<RequiredAsterisk /></Label>
                  <div className="quill-container">
                    <ReactQuill theme="snow" value={formData.specifications} onChange={(c) => { setFormData(p=>({...p, specifications:c})); if (errors.specifications) setErrors(p => ({ ...p, specifications: "" })); }} modules={quillModules} className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden" />
                  </div>
                  <FieldError msg={errors.specifications} />
                </div>
                
                <div className="md:col-span-3">
                  <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FaRulerCombined className="text-brand-500" /> Product Dimension
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>Width</Label><Input type="number" name="dimensions.width" value={formData.dimensions.width} onChange={handleInputChange} placeholder="e.g. 10 cm/m" /></div>
                      <div><Label>Height</Label><Input type="number" name="dimensions.height" value={formData.dimensions.height} onChange={handleInputChange} placeholder="e.g. 20 cm/m" /></div>
                      <div><Label>Depth</Label><Input type="number" name="dimensions.depth" value={formData.dimensions.depth} onChange={handleInputChange} placeholder="e.g. 5 cm/m" /></div>
                    </div>
                  </div>
                </div>
                <div><Label>Manufacture Country</Label><Input name="manufactureCountry" value={formData.manufactureCountry} onChange={handleInputChange} placeholder="e.g. Bangladesh" /></div>
                <div><Label>Warehouse Location</Label><Input name="warehouseLocation" value={formData.warehouseLocation} onChange={handleInputChange} placeholder="e.g. Dhaka Warehouse" /></div>
                <div><Label>Warranty Info</Label><Input name="warrantyInformation" value={formData.warrantyInformation} onChange={handleInputChange} placeholder="e.g. 1 Year Warranty" /></div>
              </div>
            </SectionCard>

            <SectionCard icon={<FaGlobe />} title="SEO & Metadata" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2"><Label>Meta Title</Label><Input name="seo.metaTitle" value={formData.seo.metaTitle} onChange={handleInputChange} placeholder="e.g. Best Smartphones for Photography in 2024" /><FieldError msg={errors.metaTitle} /></div>
                
                <div><Label>OG Title</Label><Input name="seo.ogTitle" value={formData.seo.ogTitle} onChange={handleInputChange} placeholder="Social media sharing title..." /></div>
                <div><Label>OG Description</Label><Input name="seo.ogDescription" value={formData.seo.ogDescription} onChange={handleInputChange} placeholder="Social media sharing description..." /></div>
                
                <div className="md:col-span-2"><Label>Focus Keyword</Label><Input name="seo.focusKeyword" value={formData.seo.focusKeyword} onChange={handleInputChange} placeholder="e.g. iPhone 15 Pro" /><FieldError msg={errors.focusKeyword} /></div>
                
                <div className="md:col-span-2">
                  <Label>Tags (Comma separated)</Label>
                  <div className="flex gap-2 mt-1.5">
                    <input type="text" value={tagInput} onChange={(e)=>setTagInput(e.target.value)} className="flex-1 h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:border-brand-500 dark:focus:border-brand-400 transition-all dark:placeholder:text-white/60" placeholder="e.g. electronics, mobile, sale" />
                    <button type="button" onClick={applyTags} className="bg-brand-500 text-white px-6 rounded-xl font-bold uppercase text-[10px] hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">Apply Tags</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.tag.split(",").map(x=>x.trim()).filter(Boolean).map((t, idx)=>(<span key={idx} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase flex items-center gap-2 ${tagColors[idx % tagColors.length]}`}>{t}<button type="button" onClick={()=>removeTag(t)} className="hover:scale-125 transition-transform"><FaTimesCircle /></button></span>))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label>Meta Keywords (Comma separated)</Label>
                  <div className="flex gap-2 mt-1.5">
                    <input type="text" value={metaKeywordInput} onChange={(e)=>setMetaKeywordInput(e.target.value)} className="flex-1 h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white outline-none focus:border-brand-500 dark:focus:border-brand-400 transition-all dark:placeholder:text-white/60" placeholder="e.g. phones, mobile, electronics" />
                    <button type="button" onClick={applyMetaKeywords} className="bg-brand-500 text-white px-6 rounded-xl font-bold uppercase text-[10px] hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">Apply</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 min-h-[30px]">
                    {formData.seo.metaKeywords.split(",").map(x=>x.trim()).filter(Boolean).map((k, idx)=>(<span key={idx} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase flex items-center gap-2 ${tagColors[idx % tagColors.length]}`}>{k}<button type="button" onClick={()=>removeMetaKeyword(k)} className="hover:scale-125 transition-transform"><FaTimesCircle /></button></span>))}
                  </div>
                  <FieldError msg={errors.metaKeywords} />
                </div>

                <div className="md:col-span-2"><Label>Meta Description</Label><textarea name="seo.metaDescription" value={formData.seo.metaDescription} onChange={handleInputChange} className="w-full h-[120px] p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white resize-y outline-none focus:ring-2 focus:ring-brand-500/20 dark:placeholder:text-white/60" placeholder="Describe your product for search engines (max 160 characters)..." /><FieldError msg={errors.metaDescription} /></div>
                <div className="md:col-span-2">
                  <Label>SEO ogImage</Label>
                  <DropZone onDrop={onOgImageDrop} preview={ogImagePreview} onRemove={() => { setOgImage(null); setOgImagePreview(null); }} label="Upload Social Preview Image" />
                  <FieldError msg={errors.ogImage} />
                </div>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6">
          <div className={blurClass + " space-y-6"}>
            <SectionCard icon={<FaSearchPlus />} title={<>Thumbnail{!isMultiple && <RequiredAsterisk />}</>}><DropZone onDrop={onThumbnailDrop} preview={thumbnailPreview} onRemove={() => { setThumbnail(null); setThumbnailPreview(null); }} label="Upload thumbnail" /><FieldError msg={errors.thumbnail} /></SectionCard>
            <SectionCard icon={<FaCloudUploadAlt />} title={<>Gallery{!isMultiple && <RequiredAsterisk />}</>}><GalleryDropZone onDrop={onGalleryDrop} galleryCount={gallery.length} /><FieldError msg={errors.gallery} /><div className="grid grid-cols-3 gap-2 mt-4">{galleryPreviews.map((u, i) => (<div key={i} className="relative aspect-square rounded-xl overflow-hidden border group shadow-sm bg-gray-50 dark:bg-gray-800"><img src={u} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><button onClick={()=>removeGalleryImage(i)} className="bg-red-500 text-white p-2 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300"><FaTrashAlt className="size-3" /></button></div><div className="absolute bottom-0 left-0 right-0 bg-black/20 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><p className="text-[8px] text-white font-medium text-center">{formatBytes(gallery[i]?.size)}</p></div></div>))}</div></SectionCard>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 p-5 shadow-theme-sm"><Button className="w-full bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] py-4 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all" onClick={handleSubmit} disabled={createProductMutation.isPending}>{createProductMutation.isPending ? <FaSync className="animate-spin mx-auto" /> : "Submit Product"}</Button></div>
        </div>
      </div>
    </div>
  );
};

export default CreateProductForm;
