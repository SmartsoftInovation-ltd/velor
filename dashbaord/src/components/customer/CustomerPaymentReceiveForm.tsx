import Label from "../form/Label";
import Input from "../form/input/InputField";
import DatePicker from "../form/date-picker";
import Button from "../ui/button/Button";
import SectionCard from "../common/SectionCard";
import MobileActionBar from "../common/MobileActionBar";
import { FaUser, FaMoneyBillWave } from "react-icons/fa";
import SearchableSelect from "../form/SearchableSelect";
import Select from "../form/Select";
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";

interface CustomerOption {
  label: string;
  value: string;
  due: number;
}

interface AccountOption {
  label: string;
  value: string;
}

const RequiredStar = () => <span className="text-red-500 ml-0.5">*</span>;

const CustomerPaymentReceiveForm = () => {
  const queryClient = useQueryClient();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedInvoice, setSelectedInvoice] = useState<string>("");
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<string>("");

  const [errors, setErrors] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const today = new Date().toLocaleDateString("en-CA");

  const [form, setForm] = useState<any>({
    customer: "",
    dueBalance: "",
    referenceInvoice: "",
    paidAmount: "",
    lessAmount: "",
    cashBack: "",
    date: today,
    paymentMode: "",
    remarks: "",
  });

  const handleDateChange = useCallback((dates: Date[]) => {
    const val = dates?.[0] ? dates[0].toLocaleDateString("en-CA") : "";
    setForm((prev: any) => ({ ...prev, date: val }));
    if (val) setErrors((prev: any) => ({ ...prev, date: false }));
  }, []);

  const fetchCustomers = useCallback(async () => {
    const res = await axiosSecure.get("/customer/get-customers");
    const list = res?.data?.data?.customers ?? res?.data?.data ?? [];
    const formatted: CustomerOption[] = list.map((item: any) => ({
      label: `${item.fullName} - ${item.mobileNumber}`,
      value: item?.id ?? item?.customerId ?? item?._id,
      due: item?.openingDues ?? item?.dueBalance ?? 0,
    }));
    setCustomers(formatted);
    return formatted;
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

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

  const handleCustomerChange = (value: string) => {
    setSelectedCustomer(value);
    handleChange("customer", value);
    const selected = customers.find((c) => c.value === value);
    handleChange("dueBalance", selected?.due ?? 0);
    if (errors.customer) setErrors((prev: any) => ({ ...prev, customer: false }));
  };

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

    setIsSubmitting(true);
    try {
      const payload = {
        customer: form.customer,
        referenceInvoice: form.referenceInvoice,
        paidAmount: Number(form.paidAmount),
        lessAmount: Number(form.lessAmount) || 0,
        cashBack: Number(form.cashBack) || 0,
        date: form.date,
        paymentMode: form.paymentMode,
        remarks: form.remarks,
      };

      await axiosSecure.post(`/customer/customer-payment-recived`, payload);

      queryClient.invalidateQueries({ queryKey: ["customer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      // A customer payment touches most dashboard widgets (Customer Due
      // Payment, Accounts Balance, Inflow, Overview KPIs) — invalidate every
      // "dashboard-*" query instead of naming just one and leaving the rest
      // stale until their own TTL.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === "string" &&
          query.queryKey[0].startsWith("dashboard-"),
      });
      await fetchCustomers();
      toast.success("Payment received successfully");

      setForm({
        customer: "",
        dueBalance: "",
        referenceInvoice: "",
        paidAmount: "",
        lessAmount: "",
        cashBack: "",
        date: new Date().toLocaleDateString("en-CA"),
        paymentMode: "",
        remarks: "",
      });

      setSelectedCustomer("");
      setSelectedInvoice("");
      setSelectedPaymentMode("");
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
              <Label>Customer <RequiredStar /></Label>
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
              <Label>Due Balance</Label>
              <Input type="text" value={form.dueBalance} readOnly />
            </div>
            <div className="flex flex-col md:col-span-2">
              <Label>Reference Invoice (Optional)</Label>
              <Select
                options={[{ label: "Select Invoice #", value: "" }]}
                value={selectedInvoice}
                onChange={(value) => {
                  setSelectedInvoice(value);
                  handleChange("referenceInvoice", value);
                }}
              />
            </div>
        </div>
      </SectionCard>
      <SectionCard icon={<FaMoneyBillWave />} title="Payment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col">
              <Label>Paid Amount <RequiredStar /></Label>
              <Input
                type="number"
                className={errors.paidAmount ? "border-red-500" : ""}
                value={form.paidAmount}
                onChange={(e) => {
                  handleChange("paidAmount", e.target.value);
                  if (errors.paidAmount) setErrors((prev: any) => ({ ...prev, paidAmount: false }));
                }}
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
                id="cpr-date"
                placeholder="Select a date"
                defaultDate={today}
                onChange={handleDateChange}
              />
              {errors.date && <p className="text-xs text-red-500 mt-1">Date is required</p>}
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
                Receiving...
              </span>
            ) : (
              "Receive Payment"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
};

export default CustomerPaymentReceiveForm;
