import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import SearchableSelect from "../form/SearchableSelect";
import DatePicker from "../form/date-picker";
import SectionCard from "../common/SectionCard";
import MobileActionBar from "../common/MobileActionBar";
import { FaTruck, FaMoneyBillWave, FaStickyNote } from "react-icons/fa";
import PageBreadcrumb from "../common/PageBreadCrumb";
import PageMeta from "../common/PageMeta";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";

interface SupplierOption {
  label: string;
  value: string;
  supplierId: string;
  totalPurchaseDue: number;
}

interface AccountOption {
  label: string;
  value: string;
}

interface FormState {
  date: string;
  supplierId: string;
  paidAmount: string;
  lessAmount: string;
  paymentMode: string;
  remarks: string;
}

const emptyForm: FormState = {
  date: "",
  supplierId: "",
  paidAmount: "",
  lessAmount: "",
  paymentMode: "",
  remarks: "",
};

const SupplierPaymentEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierOption | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch the payment being edited
  const { data: payment, isLoading: paymentLoading } = useQuery({
    queryKey: ["supplier-payment", id],
    queryFn: async () => {
      const { data } = await axiosSecure.get(
        `/supplier/get-supplier-due-payment/${id}`,
      );
      return data.data;
    },
    enabled: !!id,
  });

  // Suppliers dropdown
  const { data: supplierRaw, isLoading: suppliersLoading } = useQuery<SupplierOption[]>({
    queryKey: ["suppliers-dropdown"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/supplier/getsuppliers");
      const list: any[] = Array.isArray(data.data) ? data.data : [];
      return list.map((item) => ({
        label: `${item.supplierName} — ${item.mobile}`,
        value: item.supplierId,
        supplierId: item.supplierId,
        totalPurchaseDue: item.totalPurchaseDue ?? item.openingDues ?? 0,
      }));
    },
    staleTime: 2 * 60 * 1000,
  });

  // Accounts dropdown
  const { data: accountRaw, isLoading: accountsLoading } = useQuery<AccountOption[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await axiosSecure.get("/account/all-account");
      const list: any[] = data?.data?.accounts ?? data?.data ?? [];
      return list.map((item) => ({
        label: item.name,
        value: item._id,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const suppliers = supplierRaw ?? [];
  const accounts = accountRaw ?? [];

  // Populate form when payment data arrives
  useEffect(() => {
    if (!payment) return;
    const rawDate = payment.date
      ? new Date(payment.date).toLocaleDateString("en-CA")
      : "";
    setForm({
      date: rawDate,
      supplierId: payment.supplierId ?? "",
      paidAmount: String(payment.paidAmount ?? ""),
      lessAmount: String(payment.lessAmount ?? ""),
      paymentMode: payment.paymentMethod?.[0]?._id ?? payment.paymentMode ?? "",
      remarks: payment.remarks ?? "",
    });
  }, [payment]);

  // Keep selectedSupplier in sync when suppliers list + form.supplierId are both ready
  useEffect(() => {
    if (!form.supplierId || suppliers.length === 0) return;
    const found = suppliers.find((s) => s.value === form.supplierId) ?? null;
    setSelectedSupplier(found);
  }, [form.supplierId, suppliers]);

  const set = (field: keyof FormState, value: string) => {
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
      await axiosSecure.put(`/supplier/update-supplier-due-payment/${id}`, {
        date: form.date,
        paidAmount: Number(form.paidAmount),
        lessAmount: Number(form.lessAmount || 0),
        paymentMode: form.paymentMode,
        remarks: form.remarks,
      });
      toast.success("Payment updated successfully");
      queryClient.invalidateQueries({ queryKey: ["supplier-payments"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-payment", id] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      setTimeout(() => navigate("/supplier-payment-list"), 50);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (paymentLoading || suppliersLoading || accountsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-bold mb-4">Payment not found</p>
        <Link to="/supplier-payment-list">
          <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white px-6 py-2 !rounded-xl">
            Back to List
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Edit Supplier Payment - Baig Ecommerce"
        description="Update a supplier due payment"
      />
      <PageBreadcrumb
        pageTitle="Edit Supplier Payment"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/supplier-payment-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Supplier Payment List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard icon={<FaTruck />} title="Supplier & Date">
              {payment.transactionId && (
                <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    Transaction ID:
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-700 dark:text-gray-200">
                    {payment.transactionId}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Date <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    id="edit-supplier-payment-date"
                    placeholder="Select date"
                    defaultDate={form.date}
                    onChange={(_: Date[], dateStr: string) => set("date", dateStr)}
                  />
                  {errors.date && (
                    <p className="text-xs text-red-500">{errors.date}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>
                    Supplier Name <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    options={suppliers}
                    value={form.supplierId}
                    onChange={handleSupplierChange}
                    placeholder="Select supplier..."
                    searchPlaceholder="Search by name or mobile..."
                    hasError={!!errors.supplierId}
                  />
                  {errors.supplierId && (
                    <p className="text-xs text-red-500">{errors.supplierId}</p>
                  )}
                </div>
              </div>
              {selectedSupplier && (
                <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
                  <div className="size-2 rounded-full bg-amber-500 shrink-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    Outstanding due for{" "}
                    <span className="font-semibold">
                      {selectedSupplier.label.split(" —")[0]}
                    </span>
                    :{" "}
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      ৳{selectedSupplier.totalPurchaseDue.toLocaleString()}
                    </span>
                  </p>
                </div>
              )}
            </SectionCard>
            <SectionCard icon={<FaMoneyBillWave />} title="Payment">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <Label>
                    Payment Mode <span className="text-red-500">*</span>
                  </Label>
                  <SearchableSelect
                    options={accounts}
                    value={form.paymentMode}
                    onChange={(value) => set("paymentMode", value)}
                    placeholder="Select account..."
                    searchPlaceholder="Search account..."
                    hasError={!!errors.paymentMode}
                  />
                  {errors.paymentMode && (
                    <p className="text-xs text-red-500">{errors.paymentMode}</p>
                  )}
                </div>
              </div>
            </SectionCard>
          </div>
          <SectionCard icon={<FaStickyNote />} title="Remarks" className="self-start">
            <div className="flex flex-col gap-1.5">
              <Label>Remarks</Label>
              <Input
                type="text"
                placeholder="Optional note..."
                value={form.remarks}
                onChange={(e) => set("remarks", e.target.value)}
              />
            </div>
          </SectionCard>
        </div>

        <MobileActionBar>
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              onClick={() => navigate("/supplier-payment-list")}
              variant="outline"
              className="px-6 py-2.5 text-sm !rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-7 py-2.5 !bg-accent-500 hover:!bg-accent-600 !text-white font-semibold !rounded-xl transition disabled:opacity-50 min-w-[180px] flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Payment"
              )}
            </Button>
          </div>
        </MobileActionBar>
      </div>
    </>
  );
};

export default SupplierPaymentEdit;
