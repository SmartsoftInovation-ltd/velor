import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import SearchableSelect from "../form/SearchableSelect";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import Loader from "../common/Loader";

interface AccountOption {
  label: string;
  value: string;
}

const CustomerPaymentReceiveEdit = () => {
  // The payment's own _id: keyed by customer, the page showed one payment and
  // the save edited another
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    paidAmount: "",
    lessAmount: "",
    cashBack: "",
    referenceInvoice: "",
    remarks: "",
    date: "",
  });

  // fetch existing payment record
  const { data: payment, isLoading: isFetching, isError } = useQuery({
    queryKey: ["customer-payment", paymentId],
    queryFn: async () => {
      const res = await axiosSecure.get(
        `/customer/get-customer-payment-recived?id=${paymentId}`
      );
      return res?.data?.data?.customerPayment ?? null;
    },
    enabled: !!paymentId,
  });

  // The payment's customer, and their own sale invoices for Reference Invoice
  const paymentCustomer: string = payment?.customer?._id ?? payment?.customer ?? "";
  const { data: invoices = [], isFetching: invoicesLoading } = useQuery({
    queryKey: ["customer-invoices", paymentCustomer],
    enabled: !!paymentCustomer,
    queryFn: async (): Promise<{ invoiceNumber: string; date?: string; due: number }[]> => {
      const res = await axiosSecure.get(`/customer/customer-invoices/${encodeURIComponent(paymentCustomer)}`);
      return res?.data?.data?.invoices ?? [];
    },
    staleTime: 30 * 1000,
  });
  const invoiceOptions = invoices.map((inv) => ({
    value: inv.invoiceNumber,
    label: [
      inv.invoiceNumber,
      inv.date ? new Date(inv.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
      inv.due > 0 ? `Due ৳${inv.due.toLocaleString()}` : "Paid",
    ]
      .filter(Boolean)
      .join(" · "),
  }));
  // A reference saved before (or typed by hand on older payments) stays selectable
  if (form.referenceInvoice && !invoiceOptions.some((o) => o.value === form.referenceInvoice)) {
    invoiceOptions.unshift({ value: form.referenceInvoice, label: form.referenceInvoice });
  }

  // populate form once data arrives
  useEffect(() => {
    if (!payment) return;
    setForm({
      paidAmount: payment.paidAmount ?? "",
      lessAmount: payment.lessAmount ?? "",
      cashBack: payment.cashBack ?? "",
      referenceInvoice: payment.referenceInvoice ?? "",
      remarks: payment.remarks ?? "",
      date: payment.date
        ? new Date(payment.date).toISOString().split("T")[0]
        : new Date(payment.createdAt).toISOString().split("T")[0],
    });
    setSelectedPaymentMode(payment.paymentMode?._id ?? "");
  }, [payment]);

  // fetch accounts
  useEffect(() => {
    axiosSecure.get("/account/all-account").then((res) => {
      const list = res?.data?.data?.accounts ?? res?.data?.data ?? [];
      setAccounts(list.map((a: any) => ({ label: a.name, value: a._id })));
    });
  }, []);

  const handleChange = (name: string, value: any) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!paymentId) return;
    setIsLoading(true);
    try {
      const payload = {
        paidAmount: Number(form.paidAmount) || 0,
        lessAmount: Number(form.lessAmount) || 0,
        cashBack: Number(form.cashBack) || 0,
        referenceInvoice: form.referenceInvoice,
        paymentMode: selectedPaymentMode,
        remarks: form.remarks,
        date: form.date ? new Date(form.date).toISOString() : undefined,
      };
      await axiosSecure.put(
        `/customer/update-customer-payment-recived/${paymentId}`,
        payload
      );
      toast.success("Payment updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["customer-payment", paymentId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      setTimeout(() => navigate("/customer-payment-receive-list"), 50);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to update payment.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  if (isError || !payment) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-bold mb-4">Payment record not found.</p>
        <Button onClick={() => navigate("/customer-payment-receive-list")} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Edit Customer Payment - Baig Ecommerce"
        description="Edit customer payment receive record"
      />
      <PageBreadcrumb pageTitle="Edit Customer Payment" />
      <div className="space-y-6 mt-10">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-md font-medium">
                Edit Payment —{" "}
                <span className="text-accent-500">{payment.customer?.fullName}</span>
              </h2>
              <Button
                onClick={() => navigate("/customer-payment-receive-list")}
                variant="outline"
                className="px-4 py-2 rounded text-sm"
              >
                ← Back to List
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <Label>Paid Amount</Label>
              <Input
                type="number"
                value={form.paidAmount}
                onChange={(e) => handleChange("paidAmount", e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <Label>Less Amount</Label>
              <Input
                type="number"
                value={form.lessAmount}
                onChange={(e) => handleChange("lessAmount", e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <Label>Cash Back</Label>
              <Input
                type="number"
                value={form.cashBack}
                onChange={(e) => handleChange("cashBack", e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => handleChange("date", e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <Label>Payment Mode</Label>
              <SearchableSelect
                options={accounts}
                value={selectedPaymentMode}
                onChange={setSelectedPaymentMode}
                placeholder="Select Account"
                searchPlaceholder="Search account..."
              />
            </div>

            <div className="flex flex-col">
              <Label>Reference Invoice (Optional)</Label>
              <SearchableSelect
                options={invoiceOptions}
                value={form.referenceInvoice}
                onChange={(value) => handleChange("referenceInvoice", value)}
                placeholder={
                  invoicesLoading
                    ? "Loading invoices…"
                    : invoiceOptions.length
                      ? "Select Invoice #"
                      : "This customer has no invoices"
                }
                searchPlaceholder="Search invoice #..."
              />
            </div>

            <div className="flex flex-col lg:col-span-3">
              <Label>Remarks</Label>
              <Input
                type="text"
                placeholder="Enter remarks"
                value={form.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
                className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold px-6 py-2 rounded"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving...
                </span>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default CustomerPaymentReceiveEdit;
