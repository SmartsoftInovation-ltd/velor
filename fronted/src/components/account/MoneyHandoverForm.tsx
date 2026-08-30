import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FaPlus, FaSearch, FaTimes, FaChevronDown } from "react-icons/fa";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import DatePicker from "../form/date-picker";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import { showApiError } from "../../utils/apiError";

interface Account { _id: string; name: string; }

// ---------- Searchable dropdown ----------
interface SearchableDropdownProps {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (val: string) => void;
  error?: string;
  onPlusClick?: () => void;
}

const SearchableDropdown = ({
  label, placeholder, options, value, onChange, error, onPlusClick,
}: SearchableDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <button type="button" onClick={() => { setOpen((p) => !p); setSearch(""); }}
            className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm text-left transition-colors ${error ? "border-red-500" : "border-gray-300 dark:border-gray-700"} ${open ? "ring-2 ring-brand-500/20 border-brand-500" : ""}`}
          >
            <span className={selected ? "text-gray-900 dark:text-white" : "text-gray-400"}>
              {selected ? selected.label : placeholder}
            </span>
            <FaChevronDown className={`size-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          {value && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); }} className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors">
              <FaTimes className="size-3" />
            </button>
          )}
          {open && (
            <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
              <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3" />
                  <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-400 text-center">No results</p>
                ) : (
                  filtered.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors ${value === opt.value ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      {opt.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        {onPlusClick && (
          <button
            type="button"
            onClick={onPlusClick}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-[#DCE8FF] hover:bg-[#C7DAFF] active:scale-95 text-[#1D4ED8] text-xs font-semibold rounded-lg transition-all shadow-sm"
          >
            <FaPlus className="size-3" />
            Add
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
    </div>
  );
};

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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><FaTimes className="size-4" /></button>
        </div>
        <div className="space-y-1">
          <Label>Account Name</Label>
          <input autoFocus type="text" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="e.g. Cash in Hand" className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors" />
          {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
        </div>
        <div className="flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-brand-500 hover:bg-brand-600 text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// ---------- Main form ----------
const MoneyHandoverForm = () => {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10), fundPaymentMode: "", name: "", amount: "", voucherNumber: "", transactionDescription: "",
  });
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
      queryClient.invalidateQueries({ queryKey: ["fund-handovers"] });
      setFormData({ date: new Date().toISOString().slice(0, 10), fundPaymentMode: "", name: "", amount: "", voucherNumber: "", transactionDescription: "" });
      setErrors({});
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add handover");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1">
            <DatePicker id="date-picker-handover" label="Date" placeholder="Select a date"
              defaultDate={formData.date}
              onChange={(_selectedDates: Date[], dateStr: string) => set("date", dateStr)}
            />
            {errors.date && <p className="text-red-500 text-xs mt-0.5">{errors.date}</p>}
          </div>

          <SearchableDropdown label="Fund Payment Mode" placeholder="Select payment mode..."
            options={accountOptions} value={formData.fundPaymentMode}
            onChange={(val) => set("fundPaymentMode", val)}
            error={errors.fundPaymentMode}
            onPlusClick={() => setShowAccountModal(true)}
          />

          <div className="flex flex-col gap-1">
            <Label>Name</Label>
            <Input type="text" placeholder="Enter Name" value={formData.name}
              onChange={(e) => set("name", e.target.value)}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && <p className="text-red-500 text-xs mt-0.5">{errors.name}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Amount</Label>
            <Input type="number" placeholder="Enter Amount" value={formData.amount}
              onChange={(e) => set("amount", e.target.value)}
              className={errors.amount ? "border-red-500" : ""}
            />
            {errors.amount && <p className="text-red-500 text-xs mt-0.5">{errors.amount}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Voucher Number</Label>
            <Input type="text" placeholder="Enter Voucher Number" value={formData.voucherNumber}
              onChange={(e) => set("voucherNumber", e.target.value)}
              className={errors.voucherNumber ? "border-red-500" : ""}
            />
            {errors.voucherNumber && <p className="text-red-500 text-xs mt-0.5">{errors.voucherNumber}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Transaction Description</Label>
            <Input type="text" placeholder="Enter Description" value={formData.transactionDescription}
              onChange={(e) => set("transactionDescription", e.target.value)}
              className={errors.transactionDescription ? "border-red-500" : ""}
            />
            {errors.transactionDescription && <p className="text-red-500 text-xs mt-0.5">{errors.transactionDescription}</p>}
          </div>
        </div>

        <MobileActionBar>
          <Button onClick={handleSubmit} disabled={loading}
            className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-8 py-2.5 rounded-xl font-semibold border-none shadow-lg active:scale-95 transition-all"
          >
            {loading ? "Submitting..." : "Add Money Handover"}
          </Button>
        </MobileActionBar>
      </div>

      {showAccountModal && (
        <QuickAddModal onClose={() => setShowAccountModal(false)} onSave={handleSaveAccount} />
      )}
    </>
  );
};

export default MoneyHandoverForm;
