import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import DatePicker from "../form/date-picker";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../ui/table";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { MdDelete } from "react-icons/md";
import SearchableSelect from "../form/SearchableSelect";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import { showApiError } from "../../utils/apiError";

// ---------- Types ----------
interface Supplier {
  _id: string;
  supplierName: string;
  supplierId: string;
  mobile: string;
}

interface Account {
  _id: string;
  name: string;
  slug: string;
}

interface TableProduct {
  id: string | number;
  barcode: string;
  name: string;
  variantName: string;
  sku?: string;
  size: string[];
  color: string[];
  purchasePrice: number | string;
  wholesalePrice: number | string;
  retailPrice: number | string;
  stock?: number;
  quantity: number;
  image?: string;
  variantType: "singleVariant" | "multipleVariant";
  productId?: string;
  variantId?: string;
}

interface SearchResult {
  _id: string;
  name?: string;
  variantName?: string;
  barCode?: string;
  sku?: string;
  size?: string;
  color?: string;
  purchasePrice?: number;
  retailPrice?: number;
  wholesalePrice?: number;
  stock?: number;
  stockVariant?: number;
  image?: Array<{ url: string; publicId: string }>;
  product?: string;
  _type: "product" | "variant";
}

interface PurchaseFormData {
  invoiceNumber: string;
  supplierId: string;
  date: string;
  cashType: string;
  commission: number;
  shipping: number;
  payable: number;
  dueamount: number;
  paid: number;
}

// ---------- Component ----------
const UpdatePurchase: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [purchaseId, setPurchaseId] = useState<string>("");
  const [fetchLoading, setFetchLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [tableProducts, setTableProducts] = useState<TableProduct[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState<PurchaseFormData>({
    invoiceNumber: "",
    supplierId: "",
    date: "",
    cashType: "",
    commission: 0,
    shipping: 0,
    payable: 0,
    dueamount: 0,
    paid: 0,
  });

  // Fetch suppliers, accounts and existing purchase in parallel
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [suppliersRes, accountsRes, purchaseRes] = await Promise.all([
          axiosSecure.get("/supplier/getsuppliers"),
          axiosSecure.get("/account/all-account"),
          axiosSecure.get(`/purchase/single-purchase/${id}`),
        ]);

        setSuppliers(suppliersRes.data?.data || []);
        setAccounts(accountsRes.data?.data?.accounts || []);

        const data = purchaseRes.data?.data?.purchase;
        if (!data) {
          toast.error("Purchase not found!");
          return;
        }

        setPurchaseId(data._id);
        setFormData({
          invoiceNumber: data.invoiceNumber || "",
          supplierId: data.supplierId?._id || data.supplierId || "",
          date: data.date ? data.date.split("T")[0] : "",
          cashType: data.cashType?._id || data.cashType || "",
          commission: data.commission || 0,
          shipping: data.shipping || 0,
          payable: data.payable || 0,
          dueamount: data.dueamount || 0,
          paid: data.paid || 0,
        });

        const mappedProducts: TableProduct[] = (data.allproduct || [])
          .filter((p: any) => Object.keys(p).length > 0)
          .map((p: any) => {
            const variant = p.variant;
            return {
              id: variant?._id || p.product?._id || p.product || Date.now(),
              barcode: p.barCode || variant?.barCode || "",
              name: variant
                ? `${p.name || variant.variantName || ""}`
                : p.product?.name || p.name || "",
              variantName: variant?.variantName || "",
              purchasePrice: p.purchasePrice || variant?.purchasePrice || 0,
              wholesalePrice: p.wholesalePrice || variant?.wholesalePrice || 0,
              retailPrice: p.retailPrice || variant?.retailPrice || 0,
              quantity: p.quantity || 1,
              size:
                typeof p.size === "string"
                  ? p.size
                      .split(",")
                      .map((s: string) => s.trim())
                      .filter(Boolean)
                  : [],
              color:
                typeof p.color === "string"
                  ? p.color
                      .split(",")
                      .map((c: string) => c.trim())
                      .filter(Boolean)
                  : [],
              variantType: variant ? "multipleVariant" : "singleVariant",
              productId: variant ? undefined : p.product?._id || p.product,
              variantId: variant?._id,
              image: Array.isArray(variant?.image)
                ? variant.image[0]
                : typeof variant?.image === "string"
                  ? variant.image
                  : "",
            };
          });

        setTableProducts(mappedProducts);
      } catch (error) {
        showApiError(error, "Failed to load purchase data");
      } finally {
        setFetchLoading(false);
      }
    };

    fetchAll();
  }, [id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFormChange = (
    field: keyof PurchaseFormData,
    value: string | number,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateRequiredFields = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.invoiceNumber.trim())
      newErrors.invoiceNumber = "Invoice number is required";
    if (!formData.supplierId) newErrors.supplierId = "Supplier is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const searchProducts = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    try {
      const { data } = await axiosSecure.get(
        `/sales/get-sales-products?q=${encodeURIComponent(query.trim())}`,
      );
      const results: SearchResult[] = data.data || [];
      setSearchResults(results);
      setShowDropdown(results.length > 0);
    } catch {
      setSearchResults([]);
      setShowDropdown(false);
    }
  };

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchProducts(value), 400);
  };

  const selectProduct = (item: SearchResult) => {
    const isVariant = item._type === "variant";
    const imageUrl =
      Array.isArray(item.image) && item.image.length > 0
        ? item.image[0].url
        : "";
    const sizeArr =
      typeof item.size === "string" && item.size && item.size !== "N/A"
        ? [item.size]
        : [];
    const colorArr =
      typeof item.color === "string" && item.color && item.color !== "N/A"
        ? [item.color]
        : [];

    const newProduct: TableProduct = {
      id: item._id,
      barcode: item.barCode || "",
      name: isVariant ? item.variantName || "" : item.name || "",
      variantName: isVariant ? item.variantName || "" : "",
      sku: item.sku || "",
      size: sizeArr,
      color: colorArr,
      purchasePrice: item.purchasePrice || "",
      wholesalePrice: item.wholesalePrice || "",
      retailPrice: item.retailPrice || "",
      stock: isVariant ? item.stockVariant || 0 : item.stock || 0,
      quantity: 1,
      image: imageUrl,
      variantType: isVariant ? "multipleVariant" : "singleVariant",
      productId: isVariant ? undefined : item._id,
      variantId: isVariant ? item._id : undefined,
    };

    if (tableProducts.find((p) => p.id === newProduct.id)) {
      return toast.error("This product is already added!");
    }
    setTableProducts([...tableProducts, newProduct]);
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleProductChange = (
    index: number,
    field: keyof TableProduct,
    value: string | number,
  ) => {
    const updated = [...tableProducts];
    if (field === "size" || field === "color") {
      updated[index][field] =
        typeof value === "string"
          ? value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
          : [];
    } else {
      (updated[index] as any)[field] = value;
    }
    setTableProducts(updated);
  };

  const removeRow = (index: number) => {
    setTableProducts(tableProducts.filter((_, i) => i !== index));
  };

  const subTotal = tableProducts.reduce(
    (total, p) =>
      total + (parseFloat(p.purchasePrice as any) || 0) * p.quantity,
    0,
  );
  // payable = subTotal + commission + shipping
  const calculatedPayable = subTotal + formData.commission + formData.shipping;
  const calculatedDueAmount = calculatedPayable - formData.paid;

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      payable: calculatedPayable,
      dueamount: calculatedDueAmount,
    }));
  }, [subTotal, formData.commission, formData.shipping, formData.paid]);

  const handleSubmit = async () => {
    if (!validateRequiredFields()) return;
    if (tableProducts.length === 0)
      return toast.error("Add at least one product!");

    const allproduct = tableProducts.map((product) => {
      const base = {
        purchasePrice: parseFloat(product.purchasePrice as any),
        wholesalePrice: parseFloat(product.wholesalePrice as any) || 0,
        retailPrice: parseFloat(product.retailPrice as any) || 0,
        quantity: product.quantity,
        size: product.size.join(", "),
        color: product.color.join(", "),
      };
      return product.variantType === "multipleVariant"
        ? { ...base, variant: product.variantId }
        : { ...base, product: product.productId };
    });

    const payload = {
      ...formData,
      supplierId: formData.supplierId,
      cashType: formData.cashType || undefined,
      subTotal,
      allproduct,
    };

    setSubmitLoading(true);
    try {
      await axiosSecure.put(`/purchase/update-purchase/${purchaseId}`, payload);
      toast.success("Purchase updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      // A purchase edit touches most dashboard widgets (Purchase Items,
      // Inventory Value, Stock Cost, Outflow, Accounts Balance, Overview
      // KPIs) — the backend cascades its cache bump to every dashboard box
      // on write, so invalidate every "dashboard-*" query here too.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      setTimeout(() => navigate("/purchase-list"), 50);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update purchase!");
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return num % 1 === 0 ? num.toString() : num.toFixed(2);
  };

  if (fetchLoading)
    return (
      <div className="flex justify-center min-h-100 items-center">
        <div className="size-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <>
      <PageMeta
        title={`Update Purchase - ${formData.invoiceNumber}`}
        description="Update purchase details"
      />
      <PageBreadcrumb pageTitle="Update Purchase" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-md font-medium">Update Purchase</h2>
              <Link to="/purchase-list">
                <Button className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded">
                  Purchase List
                </Button>
              </Link>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Top Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <DatePicker
                label="Date"
                id="date-picker-from"
                //@ts-ignore
                value={formData.date}
                defaultDate={formData.date}
                //@ts-ignore
                onChange={(date) => handleFormChange("date", date)}
              />
              <div>
                <Label htmlFor="invoiceNumber">
                  Invoice Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={(e) =>
                    handleFormChange("invoiceNumber", e.target.value)
                  }
                  className={errors.invoiceNumber ? "border-red-500" : ""}
                />
                {errors.invoiceNumber && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.invoiceNumber}
                  </p>
                )}
              </div>
              <div>
                <Label>
                  Supplier Name <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={suppliers.map((s) => ({
                    value: s._id,
                    label: s.supplierName,
                  }))}
                  value={formData.supplierId}
                  onChange={(val) => handleFormChange("supplierId", val)}
                  placeholder="Select Supplier"
                  searchPlaceholder="Search supplier..."
                  hasError={!!errors.supplierId}
                />
                {errors.supplierId && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.supplierId}
                  </p>
                )}
              </div>
              <div>
                <Label>Cash Type</Label>
                <SearchableSelect
                  options={accounts.map((a) => ({
                    value: a._id,
                    label: a.name,
                  }))}
                  value={formData.cashType}
                  onChange={(val) => handleFormChange("cashType", val)}
                  placeholder="Select Cash Type"
                  searchPlaceholder="Search account..."
                />
              </div>
            </div>

            {/* Search */}
            <div
              className="w-full max-w-4xl space-y-4 relative"
              ref={dropdownRef}
            >
              <Label>Search Product</Label>
              <Input
                placeholder="Search by name or barcode"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <div
                        key={item._id}
                        onClick={() => selectProduct(item)}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">
                              {item._type === "variant"
                                ? item.variantName
                                : item.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              Barcode: {item.barCode || "N/A"} | Size:{" "}
                              {item.size || "N/A"} | Color:{" "}
                              {item.color || "N/A"}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-green-600">
                            ৳{item.retailPrice || 0}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No products found
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="max-w-full overflow-x-auto">
                <Table>
                  <TableHeader className="border-b border-gray-100">
                    <TableRow className="uppercase">
                      <TableCell
                        className="px-2 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Barcode
                      </TableCell>
                      <TableCell
                        className="px-2 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Product
                      </TableCell>
                      <TableCell
                        className="px-2 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Variant
                      </TableCell>
                      <TableCell
                        className="px-0 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Size
                      </TableCell>
                      <TableCell
                        className="px-0 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Color
                      </TableCell>
                      <TableCell
                        className="w-20 px-1 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Buy Rate
                      </TableCell>
                      <TableCell
                        className="w-20 px-1 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Qty
                      </TableCell>
                      <TableCell
                        className="w-25 px-1 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        WS. Price
                      </TableCell>
                      <TableCell
                        className="w-25 px-1 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Retail Price
                      </TableCell>
                      <TableCell
                        className="w-20 px-1 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Total
                      </TableCell>
                      <TableCell
                        className="px-1 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                        isHeader
                      >
                        Action
                      </TableCell>
                    </TableRow>
                  </TableHeader>

                  {tableProducts.length > 0 && (
                    <TableBody>
                      {tableProducts.map((product, index) => {
                        const purchasePrice =
                          typeof product.purchasePrice === "string"
                            ? parseFloat(product.purchasePrice) || 0
                            : product.purchasePrice || 0;
                        const totalPrice = purchasePrice * product.quantity;

                        return (
                          <TableRow key={product.id}>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input
                                className="w-32!"
                                value={product.barcode || ""}
                                disabled
                              />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input value={product.name || ""} disabled />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input
                                value={product.variantName || ""}
                                disabled
                              />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input
                                className="w-12.5!"
                                value={product.size.join(", ")}
                                disabled
                              />
                            </TableCell>
                            <TableCell className="px-0 py-3 text-theme-sm">
                              <Input
                                className="w-25!"
                                value={product.color.join(", ")}
                                disabled
                              />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input
                                className="w-25!"
                                type="number"
                                value={product.purchasePrice || ""}
                                disabled
                              />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input
                                className="w-20!"
                                type="number"
                                value={product.quantity}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "quantity",
                                    parseInt(e.target.value) || 1,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input
                                className="w-25!"
                                type="number"
                                value={product.wholesalePrice || ""}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "wholesalePrice",
                                    e.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input
                                className="w-25!"
                                type="number"
                                value={product.retailPrice || ""}
                                onChange={(e) =>
                                  handleProductChange(
                                    index,
                                    "retailPrice",
                                    e.target.value,
                                  )
                                }
                              />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Input
                                className="w-25!"
                                type="number"
                                value={formatNumber(totalPrice)}
                                readOnly
                              />
                            </TableCell>
                            <TableCell className="px-1 py-3 text-theme-sm">
                              <Button
                                onClick={() => removeRow(index)}
                                size="sm"
                                className="bg-red-500 text-white hover:bg-red-600"
                              >
                                <MdDelete />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  )}
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-gray-100 py-3 px-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <Label>SubTotal</Label>
                <Input
                  placeholder="SubTotal"
                  value={formatNumber(subTotal)}
                  readOnly
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label>Commission</Label>
                <Input
                  type="number"
                  placeholder="Commission"
                  value={formData.commission}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    handleFormChange(
                      "commission",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label>Shipping</Label>
                <Input
                  type="number"
                  placeholder="Shipping"
                  value={formData.shipping}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    handleFormChange(
                      "shipping",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label>Payable</Label>
                <Input
                  placeholder="Payable"
                  value={formatNumber(formData.payable)}
                  readOnly
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label>Paid</Label>
                <Input
                  type="number"
                  placeholder="Paid"
                  value={formData.paid}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) =>
                    handleFormChange("paid", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
              <div className="flex items-center space-x-2">
                <Label>Due</Label>
                <Input
                  placeholder="Due"
                  value={formatNumber(formData.dueamount)}
                  readOnly
                />
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={submitLoading}>
              {submitLoading ? "Updating..." : "Update Purchase"}
            </Button>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default UpdatePurchase;
