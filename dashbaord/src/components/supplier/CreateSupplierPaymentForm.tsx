import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import SearchableSelect from "../form/SearchableSelect";
import DatePicker from "../form/date-picker";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

interface SupplierOption {
  label: string;
  value: string;
  supplierId: string;
  openingDues: number;
}

interface AccountOption {
  label: string;
  value: string;
}

const today = new Date().toLocaleDateString("en-CA");

const emptyForm = {
  date: today,
  supplierId: "",
  paidAmount: "",
  lessAmount: "",
  paymentMode: "",
  remarks: "",
};

const CreateSupplierPaymentForm = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [selectedSupplier, setSelectedSupplier] =
    useState<SupplierOption | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<keyof typeof emptyForm, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Suppliers — separate key from SupplierList to avoid cache shape collision
  const { data: supplierRaw, isLoading: suppliersLoading } = useQuery<
    SupplierOption[]
  >({
    queryKey: ["suppliers-dropdown"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/supplier/getsuppliers");
      const list: any[] = Array.isArray(data.data) ? data.data : [];
      return list
        .filter((item) => item.supplierId)
        .map((item) => ({
          label: `${item.supplierName || "Unnamed"} — ${item.mobile || "—"}`,
          value: item.supplierId, // phone number — what the backend expects
          supplierId: item.supplierId,
          openingDues: item.openingDues ?? 0,
        }));
    },
    staleTime: 2 * 60 * 1000,
  });

  // Payment accounts
  const { data: accountRaw, isLoading: accountsLoading } = useQuery<
    AccountOption[]
  >({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/account/all-account");
      const list: any[] = data?.data?.accounts ?? data?.data ?? [];
      return list
        .filter((item) => item._id)
        .map((item) => ({
          label: item.name || "Unnamed account",
          value: item._id,
        }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const suppliers = supplierRaw ?? [];
  const accounts = accountRaw ?? [];

  const set = (field: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSupplierChange = (value: string) => {
    set("supplierId", value);
    const found = suppliers.find((s) => s.value === value) ?? null;
    setSelectedSupplier(found);
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.date) e.date = "Date is required";
    if (!form.supplierId) e.supplierId = "Supplier is required";
    if (!form.paidAmount || Number(form.paidAmount) <= 0)
      e.paidAmount = "Enter a valid paid amount";
    if (!form.paymentMode) e.paymentMode = "Payment mode is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosSecure.post("/supplier/create-supplier-due-payment", {
        date: form.date,
        supplierId: form.supplierId, // already the phone number (supplierId field)
        paidAmount: Number(form.paidAmount),
        lessAmount: Number(form.lessAmount || 0),
        paymentMode: form.paymentMode,
        remarks: form.remarks,
      });
      toast.success("Supplier payment created successfully");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
      setForm(emptyForm);
      setSelectedSupplier(null);
      setErrors({});
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to create payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Row 1 — Date + Supplier */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Date */}
        <div className="flex flex-col gap-1.5">
          <Label>
            Date <span className="text-red-500">*</span>
          </Label>
          <DatePicker
            id="supplier-payment-date"
            placeholder="Select date"
            defaultDate={form.date}
            onChange={(_selectedDates: Date[], dateStr: string) => set("date", dateStr)}
          />
          {errors.date && <p className="text-xs text-red-500">{errors.date}</p>}
        </div>

        {/* Supplier Name */}
        <div className="flex flex-col gap-1.5">
          <Label>
            Supplier Name <span className="text-red-500">*</span>
          </Label>
          {suppliersLoading ? (
            <div className="h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 animate-pulse" />
          ) : (
            <SearchableSelect
              options={suppliers}
              value={form.supplierId}
              onChange={handleSupplierChange}
              placeholder="Select supplier..."
              searchPlaceholder="Search by name or mobile..."
              hasError={!!errors.supplierId}
            />
          )}
          {errors.supplierId && (
            <p className="text-xs text-red-500">{errors.supplierId}</p>
          )}
        </div>
      </div>

      {/* Due balance info card — shows when a supplier is selected */}
      {selectedSupplier && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
          <div className="size-2 rounded-full bg-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Outstanding due for{" "}
            <span className="font-semibold">
              {selectedSupplier.label.split(" —")[0]}
            </span>
            :{" "}
            <span className="font-bold text-amber-600 dark:text-amber-400">
              ৳{selectedSupplier.openingDues.toLocaleString()}
            </span>
          </p>
        </div>
      )}

      {/* Row 2 — Paid Amount + Less Amount + Payment Mode */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Paid Amount */}
        <div className="flex flex-col gap-1.5">
          <Label>
            Paid Amount <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-gray-400">
              ৳
            </span>
            <Input
              type="number"
              placeholder="0"
              value={form.paidAmount}
              className={`pl-8 ${errors.paidAmount ? "border-red-400" : ""}`}
              onChange={(e) => set("paidAmount", e.target.value)}
            />
          </div>
          {errors.paidAmount && (
            <p className="text-xs text-red-500">{errors.paidAmount}</p>
          )}
        </div>

        {/* Less Amount */}
        <div className="flex flex-col gap-1.5">
          <Label>Less / Discount</Label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500 dark:text-gray-400">
              ৳
            </span>
            <Input
              type="number"
              placeholder="0"
              value={form.lessAmount}
              className="pl-8"
              onChange={(e) => set("lessAmount", e.target.value)}
            />
          </div>
        </div>

        {/* Payment Mode */}
        <div className="flex flex-col gap-1.5">
          <Label>
            Payment Mode <span className="text-red-500">*</span>
          </Label>
          {accountsLoading ? (
            <div className="h-11 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 animate-pulse" />
          ) : (
            <SearchableSelect
              options={accounts}
              value={form.paymentMode}
              onChange={(value) => set("paymentMode", value)}
              placeholder="Select account..."
              searchPlaceholder="Search account..."
              hasError={!!errors.paymentMode}
            />
          )}
          {errors.paymentMode && (
            <p className="text-xs text-red-500">{errors.paymentMode}</p>
          )}
        </div>
      </div>

      {/* Row 3 — Remarks */}
      <div className="flex flex-col gap-1.5 max-w-lg">
        <Label>Remarks</Label>
        <Input
          type="text"
          placeholder="Optional note..."
          value={form.remarks}
          onChange={(e) => set("remarks", e.target.value)}
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-4 pt-2">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
            className="px-6 py-2.5 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] font-semibold rounded-xl transition disabled:opacity-50 min-w-[180px] flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            "Create Payment"
          )}
        </Button>
      </div>
    </div>
  );
};

export default CreateSupplierPaymentForm;
