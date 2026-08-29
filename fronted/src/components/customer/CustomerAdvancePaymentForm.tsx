import Label from "../form/Label";
import Input from "../form/input/InputField";
import DatePicker from "../form/date-picker";
import Button from "../ui/button/Button";
import SearchableSelect from "../form/SearchableSelect";
import { useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";

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

  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedPaymentMode, setSelectedPaymentMode] = useState("");

  const [balance, setBalance] = useState(0);
  const [errors, setErrors] = useState<any>({});

  const today = new Date().toLocaleDateString("en-CA");

  const [form, setForm] = useState<any>({
    customer: "",
    paidAmount: "",
    advanceCashBack: "",
    paymentMode: "",
    date: today,
    remarks: "",
  });

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

  const handleSubmit = async () => {
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

    try {
      await axiosSecure.post("/customer/customer-advance-payment-recived", payload);

      queryClient.invalidateQueries({ queryKey: ["customer-advance-payments"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-transaction-history"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-accounts-balance-summary"] });
      toast.success("Advance payment received successfully");

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
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Customer */}
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

        {/* Balance */}
        <div className="flex flex-col">
          <Label>Balance</Label>
          <Input type="text" value={balance} readOnly />
        </div>

        {/* Paid Amount */}
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

        {/* Payment Mode */}
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

        {/* Date */}
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

        {/* Cash Back */}
        <div className="flex flex-col">
          <Label>Cash Back</Label>
          <Input
            type="number"
            value={form.advanceCashBack}
            onChange={(e) => handleChange("advanceCashBack", e.target.value)}
          />
        </div>

        {/* Remarks */}
        <div className="flex flex-col">
          <Label>Remarks</Label>
          <Input
            type="text"
            placeholder="Enter Remarks"
            value={form.remarks}
            onChange={(e) => handleChange("remarks", e.target.value)}
          />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
          className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-4 py-2 rounded"
      >
        Create Advance Payment
      </Button>
    </div>
  );
};

export default CustomerAdvancePaymentForm;
