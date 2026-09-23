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

interface AccountType { _id: string; name: string; }

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
          <button
            type="button"
            onClick={() => { setOpen((p) => !p); setSearch(""); }}
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
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
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
const AddMoneyTransferForm = () => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fromAccount, setFromAccount] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [transactionDesction, setTransactionDesction] = useState("");
  const [amount, setAmount] = useState("");
  const [voucherNumber, setVoucherNumber] = useState("");
  const [accounts, setAccounts] = useState<AccountType[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showToAccountModal, setShowToAccountModal] = useState(false);

  const fetchAccounts = async () => {
    const res = await axiosSecure.get("/account/all-account");
    setAccounts(res.data.data.accounts || []);
  };

  useEffect(() => {
    fetchAccounts().catch((error) => showApiError(error, "Failed to load accounts."));
  }, []);

  const handleSaveAccount = async (name: string) => {
    await axiosSecure.post("/account/create-account", { accounts: [name] });
    toast.success(`Account "${name}" created!`);
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    await fetchAccounts();
  };

  const accountOptions = accounts.map((a) => ({ value: a._id, label: a.name }));

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!date) e.date = "Date is required.";
    if (!fromAccount) e.fromAccount = "From account is required.";
    if (!toAccount) e.toAccount = "To account is required.";
    if (fromAccount && toAccount && fromAccount === toAccount) e.toAccount = "From and To accounts must differ.";
    if (!transactionDesction) e.transactionDesction = "Description is required.";
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = "Valid amount is required.";
    if (!voucherNumber) e.voucherNumber = "Voucher number is required.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    try {
      await axiosSecure.post("/moneytransfer/create-moneytransfer", {
        Date: new Date(date).toISOString(),
        fromAccount,
        toAccount,
        transactionDesction,
        amount: Number(amount),
        voucherNumber,
      });
      toast.success("Money transfer added successfully!");
      queryClient.invalidateQueries({ queryKey: ["money-transfers"] });
      setDate(new Date().toISOString().slice(0, 10)); setFromAccount(""); setToAccount(""); setTransactionDesction(""); setAmount(""); setVoucherNumber(""); setErrors({});
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add money transfer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="flex flex-col gap-1">
            <DatePicker id="date-picker-transfer" label="Date" placeholder="Select a date"
              defaultDate={date}
              onChange={(_selectedDates: Date[], dateStr: string) => { setDate(dateStr); setErrors((p) => ({ ...p, date: "" })); }}
            />
            {errors.date && <p className="text-red-500 text-xs mt-0.5">{errors.date}</p>}
          </div>

          <SearchableDropdown label="From Account" placeholder="Select from account..." options={accountOptions}
            value={fromAccount} onChange={(val) => { setFromAccount(val); setErrors((p) => ({ ...p, fromAccount: "" })); }}
            error={errors.fromAccount} onPlusClick={() => setShowAccountModal(true)}
          />

          <SearchableDropdown label="To Account" placeholder="Select to account..." options={accountOptions}
            value={toAccount} onChange={(val) => { setToAccount(val); setErrors((p) => ({ ...p, toAccount: "" })); }}
            error={errors.toAccount} onPlusClick={() => setShowToAccountModal(true)}
          />

          <div className="flex flex-col gap-1">
            <Label>Transaction Description</Label>
            <Input type="text" placeholder="Enter description" value={transactionDesction}
              onChange={(e) => { setTransactionDesction(e.target.value); setErrors((p) => ({ ...p, transactionDesction: "" })); }}
              className={errors.transactionDesction ? "border-red-500" : ""}
            />
            {errors.transactionDesction && <p className="text-red-500 text-xs mt-0.5">{errors.transactionDesction}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Amount</Label>
            <Input type="number" placeholder="Enter amount" value={amount}
              onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: "" })); }}
              className={errors.amount ? "border-red-500" : ""}
            />
            {errors.amount && <p className="text-red-500 text-xs mt-0.5">{errors.amount}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label>Voucher Number</Label>
            <Input type="text" placeholder="Enter voucher number" value={voucherNumber}
              onChange={(e) => { setVoucherNumber(e.target.value); setErrors((p) => ({ ...p, voucherNumber: "" })); }}
              className={errors.voucherNumber ? "border-red-500" : ""}
            />
            {errors.voucherNumber && <p className="text-red-500 text-xs mt-0.5">{errors.voucherNumber}</p>}
          </div>
        </div>

        <MobileActionBar>
          <Button onClick={handleSubmit} disabled={loading}
            className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-8 py-2.5 rounded-xl font-semibold border-none shadow-lg active:scale-95 transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                Submitting...
              </span>
            ) : (
              "Add Money Transfer"
            )}
          </Button>
        </MobileActionBar>
      </div>

      {showAccountModal && (
        <QuickAddModal onClose={() => setShowAccountModal(false)} onSave={handleSaveAccount} />
      )}
      {showToAccountModal && (
        <QuickAddModal onClose={() => setShowToAccountModal(false)} onSave={handleSaveAccount} />
      )}
    </>
  );
};

export default AddMoneyTransferForm;
