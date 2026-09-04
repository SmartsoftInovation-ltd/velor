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

const CustomerAdvancePaymentEdit = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    paidAmount: "",
    advanceCashBack: "",
    remarks: "",
    date: "",
  });

  // fetch existing advance payment record for this customer
  const { data: payment, isLoading: isFetching, isError } = useQuery({
    queryKey: ["customer-advance-payment", customerId],
    queryFn: async () => {
      const res = await axiosSecure.get(
        `/customer/get-customer-advance-payment-reviced?customer=${customerId}`
      );
      return res?.data?.data?.customerAdvancePayment ?? null;
    },
    enabled: !!customerId,
  });

  // populate form once data arrives
  useEffect(() => {
    if (!payment) return;
    setForm({
      paidAmount: payment.paidAmount ?? "",
      advanceCashBack: payment.advanceCashBack ?? "",
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

  // reuses the upsert create endpoint — same customer = update
  const handleSubmit = async () => {
    if (!customerId) return;
    setIsLoading(true);
    try {
      const payload = {
        customer: customerId,
        paidAmount: Number(form.paidAmount) || 0,
        advanceCashBack: Number(form.advanceCashBack) || 0,
        paymentMode: selectedPaymentMode,
        date: form.date,
        remarks: form.remarks,
      };
      await axiosSecure.post("/customer/customer-advance-payment-recived", payload);
      toast.success("Advance payment updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["customer-advance-payments"] });
      queryClient.invalidateQueries({ queryKey: ["customer-advance-payment", customerId] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
      setTimeout(() => navigate("/advance-payment-list"), 50);
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
        <p className="text-red-500 font-bold mb-4">Advance payment record not found.</p>
        <Button onClick={() => navigate("/advance-payment-list")} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Edit Advance Payment - Baig Ecommerce"
        description="Edit customer advance payment record"
      />
      <PageBreadcrumb pageTitle="Edit Advance Payment" />
      <div className="space-y-6 mt-10">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-md font-medium">
                Edit Advance Payment —{" "}
                <span className="text-brand-500">{payment.customer?.fullName}</span>
              </h2>
              <Button
                onClick={() => navigate("/advance-payment-list")}
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
              <Label>Cash Back</Label>
              <Input
                type="number"
                value={form.advanceCashBack}
                onChange={(e) => handleChange("advanceCashBack", e.target.value)}
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

            <div className="flex flex-col md:col-span-2">
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
                className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-6 py-2 rounded"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default CustomerAdvancePaymentEdit;
