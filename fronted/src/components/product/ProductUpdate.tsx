import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { 
  FaTrashAlt, FaCloudUploadAlt, FaSync, FaInfoCircle, FaCubes, FaGlobe, 
  FaSearchPlus, FaBarcode,  FaRulerCombined, 
  FaTimesCircle, FaArrowLeft
} from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import Select from "../form/Select";
import SearchableSelect from "../form/SearchableSelect";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

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

// --- MAIN COMPONENT ---
const UpdateProductForm = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [categories, setCategories] = useState<Category[]>([]);
  const [dynamicSubCategories, setDynamicSubCategories] = useState<SubCategory[]>([]);
  const [isFetchingSubCats, setIsFetchingSubCats] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [tagInput, setTagInput] = useState("");
  const [metaKeywordInput, setMetaKeywordInput] = useState("");
  const [retailMarginType, setRetailMarginType] = useState<"Percentage" | "TK">("TK");
  const [wholesaleMarginType, setWholesaleMarginType] = useState<"Percentage" | "TK">("TK");

  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [ogImage, setOgImage] = useState<File | null>(null);
  const [ogImagePreview, setOgImagePreview] = useState<string | null>(null);

  const [existingGallery, setExistingGallery] = useState<{ url: string; publicId: string }[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isDeletingImages, setIsDeletingImages] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const [formData, setFormData] = useState<FormValues>(initialFormValues);

  // Fetch initial data and product details
  useEffect(() => {
    const fetchData = async () => {
      setIsRefreshing(true);
      try {
        const [catRes, brandRes, productRes] = await Promise.all([
          axiosSecure.get("/categories"),
          axiosSecure.get("/brand"),
          axiosSecure.get(`/product/getproduct/${slug}`)
        ]);

        setCategories(catRes?.data?.data?.categories || []);
        setBrands(brandRes?.data?.data?.brands || []);

        const p = productRes?.data?.data?.product;
        if (p) {
          // Map backend data to form values
          setFormData({
            name: p.name || "",
            description: p.description || "",
            category: p.category?._id || p.category || "",
            subcategory: p.subcategory?._id || p.subcategory || "",
            brand: p.brand?._id || p.brand || "",
            variantType: p.variantType || "singleVariant",
            sku: p.sku || "",
            barCode: p.barCode || "",
            // Shows initialStock (the snapshot editable via this form) — the
            // live "stock" counter is maintained by sales/purchase/adjustment
            // controllers and isn't touched by this update form.
            stock: (p.initialStock ?? p.stock)?.toString() || "",
            alertQuantity: p.alertQuantity?.toString() || "",
            purchasePrice: p.purchasePrice?.toString() || "",
            retailPrice: p.retailPrice?.toString() || "",
            wholesalePrice: p.wholesalePrice?.toString() || "",
            size: p.size || "",
            color: p.color || "",
            weight: p.weight?.toString() || "",
            dimensions: {
              width: p.dimensions?.width?.toString() || "",
              height: p.dimensions?.height?.toString() || "",
              depth: p.dimensions?.depth?.toString() || "",
            },
            unit: p.unit || "",
            groupUnit: p.groupUnit || "",
            groupUnitQuantity: p.groupUnitQuantity?.toString() || "",
            tag: Array.isArray(p.tag) ? p.tag.join(", ") : (p.tag || ""),
            specifications: p.specifications || "",
            manufactureCountry: p.manufactureCountry || "",
            warrantyInformation: p.warrantyInformation || "",
            shippingInformation: p.shippingInformation || "",
            warehouseLocation: p.warehouseLocation || "",
            availabilityStatus: p.availabilityStatus || "In Stock",
            rating: p.rating?.toString() || "0",
            seo: {
              metaTitle: p.seo?.metaTitle || "",
              metaDescription: p.seo?.metaDescription || "",
              metaKeywords: Array.isArray(p.seo?.metaKeywords) ? p.seo.metaKeywords.join(", ") : (p.seo?.metaKeywords || ""),
              focusKeyword: p.seo?.focusKeyword || "",
              ogTitle: p.seo?.ogTitle || "",
              ogDescription: p.seo?.ogDescription || "",
            },
            retailProfitMarginbyPercentance: p.retailProfitMarginByPercentage?.toString() || "",
            retailProfitMarginbyAmount: "",
            wholesaleProfitMarginPercentage: p.wholesaleProfitMarginPercentage?.toString() || "",
            wholesaleProfitMarginAmount: "",
          });

          // Handle Previews
          if (p.thumbnail?.url) setThumbnailPreview(p.thumbnail.url);
          if (p.image?.length > 0) setExistingGallery(p.image);
          if (p.seo?.ogImage?.url) setOgImagePreview(p.seo.ogImage.url);

          // Fetch Subcategories for the loaded category
          if (p.category) {
            const catId = p.category?._id || p.category;
            const category = catRes?.data?.data?.categories.find((c: any) => c._id === catId);
            if (category?.slug) {
              const subRes = await axiosSecure.get(`/categories/${category.slug}`);
              setDynamicSubCategories(subRes?.data?.data?.category?.subcategories || []);
            }
          }
        }
      } catch { toast.error("Failed to load product data."); }
      finally { setIsRefreshing(false); }
    };
    fetchData();
  }, [slug, refreshCount]);

  // Profit Margin Logic
  useEffect(() => {
    const purchase = parseFloat(formData.purchasePrice);
    if (isNaN(purchase)) return;

    setFormData(p => {
      let updates: any = {};
      if (retailMarginType === "Percentage" && p.retailProfitMarginbyPercentance) {
        const val = parseFloat(p.retailProfitMarginbyPercentance);
        updates.retailPrice = Math.round(purchase + (purchase * val / 100)).toString();
      }
      if (wholesaleMarginType === "Percentage" && p.wholesaleProfitMarginPercentage) {
        const val = parseFloat(p.wholesaleProfitMarginPercentage);
        updates.wholesalePrice = Math.round(purchase + (purchase * val / 100)).toString();
      }
      if (Object.keys(updates).length === 0) return p;
      const isChanged = Object.keys(updates).some(k => p[k as keyof FormValues] !== updates[k]);
      if (!isChanged) return p;
      return { ...p, ...updates };
    });
  }, [
    formData.purchasePrice,
    formData.retailProfitMarginbyPercentance,
    formData.wholesaleProfitMarginPercentage,
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
    } catch { toast.error("Failed to load subcategories."); }
    finally { setIsFetchingSubCats(false); }
  };

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
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
      const finalVal = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : clean;
      
      if (name.startsWith("dimensions.")) {
        const field = name.split(".")[1];
        setFormData(p => ({ ...p, dimensions: { ...p.dimensions, [field]: finalVal } }));
      } else {
        setFormData(p => ({ ...p, [name]: finalVal }));
      }
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

  const onThumbnailDrop = useCallback((f: File[]) => { if(f[0]) { setThumbnail(f[0]); setThumbnailPreview(URL.createObjectURL(f[0])); } }, []);
  const onOgImageDrop = useCallback((f: File[]) => { if(f[0]) { setOgImage(f[0]); setOgImagePreview(URL.createObjectURL(f[0])); } }, []);
  const onGalleryDrop = useCallback((f: File[]) => {
    const total = gallery.length + existingGallery.length;
    const remaining = 10 - total;
    if (remaining <= 0) { toast.error("Max 10 images"); return; }
    const newFiles = f.slice(0, remaining);
    setGallery(p => [...p, ...newFiles]);
    setGalleryPreviews(p => [...p, ...newFiles.map(file => URL.createObjectURL(file))]);
  }, [gallery, existingGallery]);

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
    if (selectedImages.length === 0) return;
    setIsDeletingImages(true);
    try {
      await axiosSecure.delete(`/product/deleteproductimage/${slug}`, {
        data: { publicId: selectedImages }
      });
      toast.success("Images deleted successfully!");
      setSelectedImages([]);
      // Refetch product data to sync UI
      const productRes = await axiosSecure.get(`/product/getproduct/${slug}`);
      const p = productRes?.data?.data?.product;
      if (p) setExistingGallery(p.image || []);
    } catch (error) {
      toast.error("Failed to delete images.");
    } finally {
      setIsDeletingImages(false);
    }
  };

  const handleAddExtraImages = async () => {
    if (gallery.length === 0) return;
    setIsUploadingImages(true);
    const data = new FormData();
    gallery.forEach(file => data.append("image", file));

    try {
      await axiosSecure.post(`/product/addproductimage/${slug}`, data);
      toast.success("Images added successfully!");
      setGallery([]);
      setGalleryPreviews([]);
      // Refetch product data to sync UI
      const productRes = await axiosSecure.get(`/product/getproduct/${slug}`);
      const p = productRes?.data?.data?.product;
      if (p) setExistingGallery(p.image || []);
    } catch (error) {
      toast.error("Failed to add images.");
    } finally {
      setIsUploadingImages(false);
    }
  };

  const generateBarcode = () => {
    const code = Date.now().toString().substring(0, 13);
    setFormData(p => ({ ...p, barCode: code, sku: code.slice(-6) }));
  };

  const applyTags = () => { if(!tagInput.trim()) return; setFormData(p => ({ ...p, tag: p.tag ? `${p.tag}, ${tagInput}` : tagInput })); setTagInput(""); };
  const removeTag = (t: string) => {
    const updated = formData.tag.split(",").map(x => x.trim()).filter(x => x && x !== t.trim()).join(", ");
    setFormData(p => ({ ...p, tag: updated }));
  };

  const applyMetaKeywords = () => { if(!metaKeywordInput.trim()) return; setFormData(p => ({ ...p, seo: { ...p.seo, metaKeywords: p.seo.metaKeywords ? `${p.seo.metaKeywords}, ${metaKeywordInput}` : metaKeywordInput } })); setMetaKeywordInput(""); };
  const removeMetaKeyword = (k: string) => {
    const updated = formData.seo.metaKeywords.split(",").map(x => x.trim()).filter(x => x && x !== k.trim()).join(", ");
    setFormData(p => ({ ...p, seo: { ...p.seo, metaKeywords: updated } }));
  };

  const updateProductMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await axiosSecure.put(`/product/updateproductinfo/${slug}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Product Updated Successfully!");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate("/product-list");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Update failed.");
    },
  });

  const handleSubmit = async () => {
    const isMultiple = formData.variantType === "multipleVariant";
    const newErrors: ValidationErrors = {};

    const hasSpecText = formData.specifications && formData.specifications.replace(/<[^>]*>/g, "").trim().length > 0;
    if (!hasSpecText && !isMultiple) {
      newErrors.specifications = "Specifications is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields.");
      return;
    }

    const data = new FormData();

    const appendToFormData = (key: string, value: any) => {
      if (value === "" || value === null || value === undefined) return;
      if (key === "seo" || key === "dimensions") {
        Object.entries(value).forEach(([subK, subV]) => {
          if (subV !== "" && subV !== null && subV !== undefined) {
            if (subK === "metaKeywords") {
              const keywords = subV.toString().split(",").map((x: string) => x.trim()).filter(Boolean);
              keywords.forEach((k: string) => data.append(`${key}[${subK}][]`, k));
            } else {
              data.append(`${key}[${subK}]`, subV.toString());
            }
          }
        });
      } else if (key === "tag") {
        const tags = value.toString().split(",").map((x: string) => x.trim()).filter(Boolean);
        tags.forEach((t: string) => data.append("tag[]", t));
      } else {
        data.append(key, value.toString());
      }
    };

    if (isMultiple) {
      // For Multiple Variant, only send Core Identity fields
      const coreFields = ["name", "description", "category", "subcategory", "brand", "variantType"];
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
    updateProductMutation.mutate(data);
  };

  const isMultiple = formData.variantType === "multipleVariant";
  const blurClass = isMultiple ? "opacity-40 pointer-events-none blur-[1.5px] grayscale-[50%] transition-all duration-500" : "transition-all duration-500";

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center gap-4">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:text-brand-500 hover:border-brand-300 transition-all shadow-sm rounded-xl px-4 py-2"
        >
          <FaArrowLeft className="size-4" />
          <span className="font-semibold text-sm">Back</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard icon={<FaInfoCircle />} title="Update Core Identity">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2"><Label>Product Name<RequiredAsterisk /></Label><Input name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. Nike Air Max" /><FieldError msg={errors.name} /></div>
              <div><Label>Category<RequiredAsterisk /></Label><SearchableSelect options={categories.map(c => ({ value: c._id, label: c.name }))} value={formData.category} onChange={handleCategoryChange} /><FieldError msg={errors.category} /></div>
              <div><Label>Subcategory<RequiredAsterisk /></Label><SearchableSelect options={dynamicSubCategories.map(s => ({ value: s._id, label: s.name }))} value={formData.subcategory} onChange={(v) => setFormData(p => ({ ...p, subcategory: v }))} placeholder={isFetchingSubCats ? "Loading..." : "Select Subcategory"} /><FieldError msg={errors.subcategory} /></div>
              <div><Label>Brand<RequiredAsterisk /></Label><SearchableSelect options={brands.map(b => ({ value: b._id, label: b.name }))} value={formData.brand} onChange={(v) => setFormData(p => ({ ...p, brand: v }))} /><FieldError msg={errors.brand} /></div>
              <div><Label>Variant Type<RequiredAsterisk /></Label><Select disabled options={[{value:"singleVariant", label:"Single Variant"}, {value:"multipleVariant", label:"Multiple Variant"}]} value={formData.variantType} onChange={(v) => setFormData(p => ({...p, variantType: v as any}))} /></div>
              <div className="md:col-span-2"><Label>Description</Label><div className="quill-container"><ReactQuill theme="snow" value={formData.description} onChange={(c) => setFormData(p=>({...p, description:c}))} modules={quillModules} className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden" /><style>{`.ql-editor { min-height: 200px; }`}</style></div></div>
            </div>
          </SectionCard>

          {!isMultiple && (
            <SectionCard icon={<FaCubes />} title="Pricing & Inventory">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mb-8 items-end">
                <div className="md:col-span-4"><Label>Barcode<RequiredAsterisk /></Label><Input name="barCode" value={formData.barCode} onChange={handleInputChange} placeholder="e.g. 1234567890123" /><FieldError msg={errors.barCode} /></div>
                <div className="md:col-span-1"><button type="button" onClick={generateBarcode} className="w-full h-11 rounded-xl bg-orange-500 hover:bg-orange-600 transition-all flex items-center justify-center shadow-sm group"><FaBarcode className="text-white text-xl group-hover:scale-110 transition-transform" /></button></div>
                <div className="md:col-span-4"><Label>SKU<RequiredAsterisk /></Label><Input name="sku" value={formData.sku} onChange={handleInputChange} placeholder="e.g. AZU-TEW-14" /><FieldError msg={errors.sku} /></div>
                <div className="md:col-span-3"><Label>Stock</Label><Input type="number" name="stock" value={formData.stock} onChange={handleInputChange} disabled placeholder="e.g. 50" /><FieldError msg={errors.stock} /></div>
                <div className="md:col-span-12"><Label>Purchase Price<RequiredAsterisk /></Label><Input type="number" name="purchasePrice" value={formData.purchasePrice} onChange={handleInputChange} placeholder="e.g. 600" /><FieldError msg={errors.purchasePrice} /></div>
              </div>
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
                  <div><Label>Retail Price Type</Label><Select options={[{value:"Percentage", label:"Percentage"}, {value:"TK", label:"TK"}]} value={retailMarginType} onChange={(v)=>setRetailMarginType(v as any)} /></div>
                  {retailMarginType === "Percentage" ? (
                    <><div className="md:col-span-1"><Label>Margin (%)</Label><Input name="retailProfitMarginbyPercentance" value={formData.retailProfitMarginbyPercentance} onChange={handleInputChange} placeholder="10" /></div><div className="md:col-span-2"><Label>Retail Price<RequiredAsterisk /></Label><Input type="number" name="retailPrice" value={formData.retailPrice} onChange={handleInputChange} placeholder="e.g. 800" /></div></>
                  ) : (
                    <div className="md:col-span-3"><Label>Retail Price<RequiredAsterisk /></Label><Input type="number" name="retailPrice" value={formData.retailPrice} onChange={handleInputChange} placeholder="e.g. 800" /></div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 items-end">
                  <div><Label>Wholesale Price Type</Label><Select options={[{value:"Percentage", label:"Percentage"}, {value:"TK", label:"TK"}]} value={wholesaleMarginType} onChange={(v)=>setWholesaleMarginType(v as any)} /></div>
                  {wholesaleMarginType === "Percentage" ? (
                    <><div className="md:col-span-1"><Label>Margin (%)</Label><Input name="wholesaleProfitMarginPercentage" value={formData.wholesaleProfitMarginPercentage} onChange={handleInputChange} placeholder="5" /></div><div className="md:col-span-2"><Label>Wholesale Price</Label><Input type="number" name="wholesalePrice" value={formData.wholesalePrice} onChange={handleInputChange} placeholder="e.g. 700" /></div></>
                  ) : (
                    <div className="md:col-span-3"><Label>Wholesale Price</Label><Input type="number" name="wholesalePrice" value={formData.wholesalePrice} onChange={handleInputChange} placeholder="e.g. 700" /></div>
                  )}
                </div>
                <div><Label>Alert Variant Stock<RequiredAsterisk /></Label><Input type="number" name="alertQuantity" value={formData.alertQuantity} onChange={handleInputChange} placeholder="e.g. 5" /></div>
              </div>
            </SectionCard>
          )}

          <div className={blurClass}>
            <SectionCard icon={<FaRulerCombined />} title="Attributes & Logistics">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div><Label>Size<RequiredAsterisk /></Label><Input name="size" value={formData.size} onChange={handleInputChange} placeholder="XL, 42, etc" /><FieldError msg={errors.size} /></div>
                <div><Label>Color<RequiredAsterisk /></Label><Input name="color" value={formData.color} onChange={handleInputChange} placeholder="Red, Blue" /><FieldError msg={errors.color} /></div>
                <div><Label>Product Weight<RequiredAsterisk /></Label><Input type="number" name="weight" value={formData.weight} onChange={handleInputChange} placeholder="e.g. 0.5 kg" /><FieldError msg={errors.weight} /></div>
                <div><Label>Unit<RequiredAsterisk /></Label><Select options={[{value:"Piece", label:"Piece"}, {value:"Kg", label:"Kg"}, {value:"Gram", label:"Gram"}, {value:"Packet", label:"Packet"}]} value={formData.unit} onChange={(v)=>setFormData(p=>({...p, unit:v}))} onClear={()=>setFormData(p=>({...p, unit:""}))} /><FieldError msg={errors.unit} /></div>
                <div><Label>Group Unit</Label><Select options={[{value:"Box", label:"Box"}, {value:"Dozen", label:"Dozen"}, {value:"Packet", label:"Packet"}]} value={formData.groupUnit} onChange={(v)=>setFormData(p=>({...p, groupUnit:v}))} onClear={()=>setFormData(p=>({...p, groupUnit:""}))} /></div>
                <div><Label>Group Qty</Label><Input type="number" name="groupUnitQuantity" value={formData.groupUnitQuantity} onChange={handleInputChange} placeholder="e.g. 10" /></div>
                
                <div className="md:col-span-3">
                  <Label>Specifications<RequiredAsterisk /></Label>
                  <div className="quill-container">
                    <ReactQuill theme="snow" value={formData.specifications} onChange={(c) => {
                      setFormData(p=>({...p, specifications:c}));
                      if (errors.specifications) setErrors(p => ({ ...p, specifications: "" }));
                    }} modules={quillModules} className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden" />
                    <style>{`.ql-editor { min-height: 200px; }`}</style>
                  </div>
                  <FieldError msg={errors.specifications} />
                </div>

                <div className="md:col-span-3">
                  <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/20">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><FaRulerCombined className="text-brand-500" /> Product Dimension</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div><Label>Width</Label><Input type="number" name="dimensions.width" value={formData.dimensions.width} onChange={handleInputChange} placeholder="e.g. 10" /></div>
                      <div><Label>Height</Label><Input type="number" name="dimensions.height" value={formData.dimensions.height} onChange={handleInputChange} placeholder="e.g. 20" /></div>
                      <div><Label>Depth</Label><Input type="number" name="dimensions.depth" value={formData.dimensions.depth} onChange={handleInputChange} placeholder="e.g. 5" /></div>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard icon={<FaGlobe />} title="SEO & Metadata" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2"><Label>Meta Title</Label><Input name="seo.metaTitle" value={formData.seo.metaTitle} onChange={handleInputChange} placeholder="SEO optimized title" /></div>
                <div className="md:col-span-2"><Label>Focus Keyword</Label><Input name="seo.focusKeyword" value={formData.seo.focusKeyword} onChange={handleInputChange} placeholder="Main focus keyword" /></div>
                <div className="md:col-span-2">
                  <Label>Tags (Comma separated)</Label>
                  <div className="flex gap-2 mt-1.5">
                    <input type="text" value={tagInput} onChange={(e)=>setTagInput(e.target.value)} className="flex-1 h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white outline-none focus:border-brand-500 dark:focus:border-brand-400 transition-all dark:placeholder:text-white/60" placeholder="e.g. electronics, mobile, sale" />
                    <button type="button" onClick={applyTags} className="bg-brand-500 text-white px-6 rounded-xl font-bold uppercase text-[10px] hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">Apply Tags</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.tag.split(",").map(x=>x.trim()).filter(Boolean).map((t, idx)=>(
                      <span key={idx} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase flex items-center gap-2 ${tagColors[idx % tagColors.length]}`}>
                        {t}
                        <button type="button" onClick={()=>removeTag(t)} className="hover:scale-125 transition-transform"><FaTimesCircle /></button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <Label>Meta Keywords (Comma separated)</Label>
                  <div className="flex gap-2 mt-1.5">
                    <input type="text" value={metaKeywordInput} onChange={(e)=>setMetaKeywordInput(e.target.value)} className="flex-1 h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white outline-none focus:border-brand-500 dark:focus:border-brand-400 transition-all dark:placeholder:text-white/60" placeholder="e.g. phones, mobile, electronics" />
                    <button type="button" onClick={applyMetaKeywords} className="bg-brand-500 text-white px-6 rounded-xl font-bold uppercase text-[10px] hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20">Apply</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 min-h-[30px]">
                    {formData.seo.metaKeywords.split(",").map(x=>x.trim()).filter(Boolean).map((k, idx)=>(
                      <span key={idx} className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase flex items-center gap-2 ${tagColors[idx % tagColors.length]}`}>
                        {k}
                        <button type="button" onClick={()=>removeMetaKeyword(k)} className="hover:scale-125 transition-transform"><FaTimesCircle /></button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2"><Label>Meta Description</Label><textarea name="seo.metaDescription" value={formData.seo.metaDescription} onChange={handleInputChange} className="w-full h-[120px] p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 dark:text-white resize-y outline-none focus:ring-2 focus:ring-brand-500/20" placeholder="Meta description for search engines..." /></div>
                <div className="md:col-span-2"><Label>SEO ogImage</Label><DropZone onDrop={onOgImageDrop} preview={ogImagePreview} onRemove={() => { setOgImage(null); setOgImagePreview(null); }} label="Upload Social Preview Image" /></div>
              </div>
            </SectionCard>
          </div>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6">
          <div className={blurClass + " space-y-6"}>
            <SectionCard icon={<FaSearchPlus />} title={<>Thumbnail{!isMultiple && <RequiredAsterisk />}</>}><DropZone onDrop={onThumbnailDrop} preview={thumbnailPreview} onRemove={() => { setThumbnail(null); setThumbnailPreview(null); }} label="Upload thumbnail" /></SectionCard>
            <SectionCard 
              icon={<FaCloudUploadAlt />} 
              title={
                <div className="flex justify-between items-center w-full ml-5 pr-4">
                  <span>Gallery{!isMultiple && <RequiredAsterisk />}</span>
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
              }
            >
              <GalleryDropZone onDrop={onGalleryDrop} galleryCount={gallery.length + existingGallery.length} />
              
              <div className="grid grid-cols-3 gap-2 mt-4">
                {existingGallery.map((img, i) => (
                  <div 
                    key={`exist-${i}`} 
                    className={`relative aspect-square rounded-xl overflow-hidden border group shadow-sm transition-all cursor-zoom-in ${
                      selectedImages.includes(img.publicId) ? "ring-2 ring-red-500 border-red-500" : "border-gray-200 hover:border-brand-400"
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
                        onClick={(e) => { e.stopPropagation(); toggleImageSelection(img.publicId); }} 
                        className={`p-2 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300 ${
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
                      <button onClick={(e) => { e.stopPropagation(); removeNewGalleryImage(i); }} className="bg-red-500 text-white p-2 rounded-full shadow-lg transform scale-75 group-hover:scale-100 transition-all duration-300"><FaTrashAlt className="size-3" /></button>
                    </div>
                    <div className="absolute top-1 left-1 bg-emerald-500 text-[8px] text-white px-1.5 py-0.5 rounded-full font-bold uppercase shadow-sm">New Upload</div>
                  </div>
                ))}
              </div>

              {gallery.length > 0 && (
                <div className="mt-6 space-y-2">
                  <Button 
                    className="w-full bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] text-xs font-black py-4 rounded-xl flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all animate-pulse"
                    onClick={handleAddExtraImages}
                    disabled={isUploadingImages}
                  >
                    {isUploadingImages ? <FaSync className="animate-spin text-lg" /> : <FaCloudUploadAlt className="text-lg" />}
                    UPLOAD & ADD NEW IMAGES
                  </Button>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold text-center uppercase tracking-wider">Please upload new images before updating product</p>
                </div>
              )}
            </SectionCard>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 p-5 shadow-theme-sm relative space-y-3">
            <Button 
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg transition-all ${
                (gallery.length > 0 || selectedImages.length > 0)
                  ? "bg-gray-400 text-white cursor-not-allowed opacity-70" 
                  : "bg-brand-500 text-white shadow-brand-500/25 active:scale-95 hover:bg-brand-600"
              }`} 
              onClick={handleSubmit} 
              disabled={updateProductMutation.isPending || gallery.length > 0 || selectedImages.length > 0}
            >
              {updateProductMutation.isPending ? <FaSync className="animate-spin mx-auto" /> : "Update Product"}
            </Button>
            <Button 
              className="w-full py-3 rounded-2xl font-bold uppercase tracking-widest text-xs border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95 flex items-center justify-center gap-2"
              onClick={() => setRefreshCount(c => c + 1)}
              disabled={isRefreshing}
            >
              <FaSync className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Refreshing..." : "Refresh Data"}
            </Button>

            {(gallery.length > 0 || selectedImages.length > 0) && (
              <p className="mt-3 text-[10px] text-red-500 font-black text-center uppercase tracking-tighter animate-bounce">
                ⚠ Action Required: {gallery.length > 0 ? "Upload new gallery images" : "Delete selected gallery images"} first!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateProductForm;
