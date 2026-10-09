import Label from "../form/Label";
import Input from "../form/input/InputField";
import DatePicker from "../form/date-picker";
import Button from "../ui/button/Button";
import SectionCard from "../common/SectionCard";
import MobileActionBar from "../common/MobileActionBar";
import { FaUser, FaMoneyBillWave } from "react-icons/fa";
import SearchableSelect from "../form/SearchableSelect";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "customer-advance-payment";

interface CustomerOption {
  label: string;
  value: string;
}

interface AccountOption {
  label: string;
  value: string;
}

const RequiredStar = () => <span className="text-red-500 ml-0.5">*</span>;

const CustomerAdvancePaymentForm = () => {
  const queryClient = useQueryClient();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState(() => draftValue(DRAFT_KEY, "selectedCustomer", ""));
  const [selectedPaymentMode, setSelectedPaymentMode] = useState(() => draftValue(DRAFT_KEY, "selectedPaymentMode", ""));

  const [balance, setBalance] = useState(0);
  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toLocaleDateString("en-CA");

  const [form, setForm] = useState<any>(() => draftValue(DRAFT_KEY, "form", {
    customer: "",
    paidAmount: "",
    advanceCashBack: "",
    paymentMode: "",
    date: today,
    remarks: "",
  }));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ selectedCustomer, selectedPaymentMode, form }), [selectedCustomer, selectedPaymentMode, form]),
  );

  const handleDateChange = useCallback((dates: Date[]) => {
    const val = dates?.[0] ? dates[0].toLocaleDateString("en-CA") : "";
    setForm((prev: any) => ({ ...prev, date: val }));
    if (val) setErrors((prev: any) => ({ ...prev, date: false }));
  }, []);

  useEffect(() => {
    axiosSecure.get("/customer/get-customers").then((res) => {
      const list = res?.data?.data?.customers ?? res?.data?.data ?? [];
      const formatted: CustomerOption[] = list.map((item: any) => ({
        label: `${item.fullName} - ${item.mobileNumber}`,
        value: item?.id ?? item?.customerId ?? item?._id,
      }));
      setCustomers(formatted);
    });
  }, []);

  useEffect(() => {
    axiosSecure.get("/account/all-account").then((res) => {
      const list = res?.data?.data?.accounts ?? res?.data?.data ?? [];
      const formatted: AccountOption[] = list.map((item: any) => ({
        label: item.name,
        value: item._id,
      }));
      setAccounts(formatted);
    });
  }, []);

  const handleChange = (name: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleCustomerChange = async (value: string) => {
    setSelectedCustomer(value);
    handleChange("customer", value);
    if (errors.customer) setErrors((prev: any) => ({ ...prev, customer: false }));

    if (!value) {
      setBalance(0);
      return;
    }

    try {
      const res = await axiosSecure.get(
        `/customer/get-customer-advance-payment-reviced?customer=${value}`,
      );
      setBalance(res?.data?.data?.customerAdvancePayment?.balance ?? 0);
    } catch {
      setBalance(0);
    }
  };

  // A customer restored from a draft still needs its advance balance loaded.
  useEffect(() => {
    if (selectedCustomer) handleCustomerChange(selectedCustomer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    // A second click while the first request is in flight would record the
    // payment twice.
    if (isSubmitting) return;
    const newErrors: any = {};
    if (!form.customer) newErrors.customer = true;
    if (!form.paidAmount) newErrors.paidAmount = true;
    if (!form.paymentMode) newErrors.paymentMode = true;
    if (!form.date) newErrors.date = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload = {
      customer: form.customer,
      paidAmount: Number(form.paidAmount),
      advanceCashBack: Number(form.advanceCashBack || 0),
      paymentMode: form.paymentMode,
      date: form.date,
      remarks: form.remarks,
    };

    setIsSubmitting(true);
    try {
      await axiosSecure.post("/customer/customer-advance-payment-recived", payload);

      queryClient.invalidateQueries({ queryKey: ["customer-advance-payments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
      // Every dashboard widget, not just the balance box: each is keyed by
      // range, so a prefix match is what refreshes the one on screen.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      toast.success("Advance payment received successfully");
      clearDraft(DRAFT_KEY);

      setForm({
        customer: "",
        paidAmount: "",
        advanceCashBack: "",
        paymentMode: "",
        date: new Date().toLocaleDateString("en-CA"),
        remarks: "",
      });

      setSelectedCustomer("");
      setSelectedPaymentMode("");
      setBalance(0);
      setErrors({});
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard icon={<FaUser />} title="Customer">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col">
              <Label>Customer Name <RequiredStar /></Label>
              <SearchableSelect
                options={customers}
                value={selectedCustomer}
                onChange={handleCustomerChange}
                placeholder="Select Customer"
                searchPlaceholder="Search by name or mobile..."
                hasError={!!errors.customer}
              />
              {errors.customer && <p className="text-xs text-red-500 mt-1">Customer is required</p>}
            </div>
            <div className="flex flex-col">
              <Label>Balance</Label>
              <Input type="text" value={balance} readOnly />
            </div>
        </div>
      </SectionCard>
      <SectionCard icon={<FaMoneyBillWave />} title="Payment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col">
              <Label>Paid Amount <RequiredStar /></Label>
              <Input
                type="number"
                value={form.paidAmount}
                onChange={(e) => {
                  handleChange("paidAmount", e.target.value);
                  if (errors.paidAmount) setErrors((prev: any) => ({ ...prev, paidAmount: false }));
                }}
                className={errors.paidAmount ? "border-red-500" : ""}
              />
              {errors.paidAmount && <p className="text-xs text-red-500 mt-1">Paid amount is required</p>}
            </div>
            <div className="flex flex-col">
              <Label>Payment Mode <RequiredStar /></Label>
              <SearchableSelect
                options={accounts}
                value={selectedPaymentMode}
                onChange={(value) => {
                  setSelectedPaymentMode(value);
                  handleChange("paymentMode", value);
                  if (errors.paymentMode) setErrors((prev: any) => ({ ...prev, paymentMode: false }));
                }}
                placeholder="Select Account"
                searchPlaceholder="Search account..."
                hasError={!!errors.paymentMode}
              />
              {errors.paymentMode && <p className="text-xs text-red-500 mt-1">Payment mode is required</p>}
            </div>
            <div className="flex flex-col">
              <Label>Date <RequiredStar /></Label>
              <DatePicker
                id="cap-date"
                placeholder="Select a date"
                defaultDate={today}
                onChange={handleDateChange}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">Date is required</p>}
            </div>
            <div className="flex flex-col">
              <Label>Cash Back</Label>
              <Input
                type="number"
                value={form.advanceCashBack}
                onChange={(e) => handleChange("advanceCashBack", e.target.value)}
              />
            </div>
            <div className="flex flex-col md:col-span-2">
              <Label>Remarks</Label>
              <Input
                type="text"
                placeholder="Enter Remarks"
                value={form.remarks}
                onChange={(e) => handleChange("remarks", e.target.value)}
              />
            </div>
        </div>
      </SectionCard>

      <MobileActionBar>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
              className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold px-7 py-2.5 !rounded-xl text-sm min-w-36 disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating...
              </span>
            ) : (
              "Create Advance Payment"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
};

export default CustomerAdvancePaymentForm;
