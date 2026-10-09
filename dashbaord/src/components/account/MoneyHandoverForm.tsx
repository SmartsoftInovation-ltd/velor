import { useEffect, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FaPlus, FaTimes, FaHandHoldingUsd } from "react-icons/fa";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import DatePicker from "../form/date-picker";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import SearchableSelect from "../form/SearchableSelect";
import SectionCard from "../common/SectionCard";
import { showApiError } from "../../utils/apiError";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "money-handover";

interface Account { _id: string; name: string; }

// ---------- Searchable dropdown ----------
// Thin wrapper over the shared SearchableSelect (same look as every other
// dropdown in the dashboard) that keeps this form's label / error / quick-add
// "Add" button layout.
interface SearchableDropdownProps {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  error?: string;
  onPlusClick?: () => void;
  plusLabel?: string;
  required?: boolean;
}

const SearchableDropdown = ({
  label, placeholder, options, value, onChange, error, onPlusClick, plusLabel, required,
}: SearchableDropdownProps) => (
  <div className="flex flex-col gap-1">
    <Label>{label}{required && <span className="text-red-500"> *</span>}</Label>
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <SearchableSelect
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          searchPlaceholder={`Search ${label.toLowerCase()}...`}
          hasError={!!error}
        />
      </div>
      {onPlusClick && (
        <button
          type="button"
          onClick={onPlusClick}
          aria-label={plusLabel ?? `Add ${label.toLowerCase()}`}
          className="shine shrink-0 inline-flex items-center gap-1.5 h-11 px-3 rounded-lg border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 text-xs font-semibold transition-colors"
        >
          <FaPlus className="size-3" />
          Add
        </button>
      )}
    </div>
    {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
  </div>
);

// ---------- Quick-add modal ----------
const QuickAddModal = ({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => Promise<void> }) => {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!name.trim()) { setError("Account name is required."); return; }
    setSaving(true);
    try { await onSave(name.trim()); onClose(); }
    catch { setError("Failed to create account."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Account</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><FaTimes className="size-4" /></button>
        </div>
        <div className="space-y-1">
          <Label>Account Name <span className="text-red-500">*</span></Label>
          <input autoFocus type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Cash in Hand" className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-colors" />
          {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
        </div>
        <div className="flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 !bg-accent-500 hover:!bg-accent-600 !text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all">
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------- Main form ----------
const MoneyHandoverForm = () => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(() => draftValue(DRAFT_KEY, "formData", {
    date: new Date().toLocaleDateString("en-CA"), fundPaymentMode: "", name: "", amount: "", voucherNumber: "", transactionDescription: "",
  }));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ formData }), [formData]),
  );
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const fetchAccounts = async () => {
    const res = await axiosSecure.get("/account/all-account");
    setAccounts(res.data.data.accounts || []);
  };

  useEffect(() => {
    fetchAccounts().catch((error) => showApiError(error, "Failed to load payment modes."));
  }, []);

  const handleSaveAccount = async (name: string) => {
    await axiosSecure.post("/account/create-account", { accounts: [name] });
    toast.success(`Account "${name}" created!`);
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    await fetchAccounts();
  };

  const accountOptions = accounts.map((a) => ({ value: a._id, label: a.name }));

  const set = (key: string, value: string) => {
    setFormData((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.date) e.date = "Please select a date.";
    if (!formData.fundPaymentMode) e.fundPaymentMode = "Please select a payment mode.";
    if (!formData.name) e.name = "Name is required.";
    if (!formData.amount) e.amount = "Amount is required.";
    if (!formData.voucherNumber) e.voucherNumber = "Voucher number is required.";
    if (!formData.transactionDescription) e.transactionDescription = "Description is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      await axiosSecure.post("/fundhandover/create-fundhandover", {
        date: formData.date,
        transactionDescription: formData.transactionDescription,
        name: formData.name,
        voucherNumber: formData.voucherNumber,
        fundPaymentMode: formData.fundPaymentMode,
        amount: Number(formData.amount),
      });
      toast.success("Money handover added successfully!");
      clearDraft(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ["fund-handovers"] });
      setFormData({ date: new Date().toLocaleDateString("en-CA"), fundPaymentMode: "", name: "", amount: "", voucherNumber: "", transactionDescription: "" });
      setErrors({});
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add handover");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard icon={<FaHandHoldingUsd />} title="Handover Details" className="lg:col-span-3 self-start">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1">
                <Label>Date <span className="text-red-500">*</span></Label>
                <DatePicker id="date-picker-handover" placeholder="Select a date"
                  defaultDate={formData.date}
                  onChange={(_selectedDates: Date[], dateStr: string) => set("date", dateStr)}
                />
                {errors.date && <p className="text-red-500 text-xs mt-0.5">{errors.date}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Label>Voucher Number <span className="text-red-500">*</span></Label>
                <Input type="text" placeholder="Enter Voucher Number" value={formData.voucherNumber}
                  onChange={(e) => set("voucherNumber", e.target.value)}
                  className={errors.voucherNumber ? "border-red-500" : ""}
                />
                {errors.voucherNumber && <p className="text-red-500 text-xs mt-0.5">{errors.voucherNumber}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input type="text" placeholder="Enter Name" value={formData.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && <p className="text-red-500 text-xs mt-0.5">{errors.name}</p>}
              </div>
              <SearchableDropdown label="Fund Payment Mode" placeholder="Select payment mode..."
                options={accountOptions} value={formData.fundPaymentMode}
                onChange={(val) => set("fundPaymentMode", val)}
                error={errors.fundPaymentMode}
                onPlusClick={() => setShowAccountModal(true)}
                required
              />
              <div className="flex flex-col gap-1">
                <Label>Amount <span className="text-red-500">*</span></Label>
                <Input type="number" placeholder="Enter Amount" value={formData.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  className={errors.amount ? "border-red-500" : ""}
                />
                {errors.amount && <p className="text-red-500 text-xs mt-0.5">{errors.amount}</p>}
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label>Transaction Description <span className="text-red-500">*</span></Label>
                <Input type="text" placeholder="Enter Description" value={formData.transactionDescription}
                  onChange={(e) => set("transactionDescription", e.target.value)}
                  className={errors.transactionDescription ? "border-red-500" : ""}
                />
                {errors.transactionDescription && <p className="text-red-500 text-xs mt-0.5">{errors.transactionDescription}</p>}
              </div>
            </div>
          </SectionCard>

        </div>

        <MobileActionBar>
          <div className="flex justify-end pt-2">
          <Button onClick={handleSubmit} disabled={loading}
            className="!bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-2.5 !rounded-xl font-semibold border-none shadow-lg active:scale-95 transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Submitting...
              </span>
            ) : (
              "Add Money Handover"
            )}
          </Button>
          </div>
        </MobileActionBar>
      </div>

      {showAccountModal && (
        <QuickAddModal onClose={() => setShowAccountModal(false)} onSave={handleSaveAccount} />
      )}
    </>
  );
};

export default MoneyHandoverForm;
