import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FaPlus, FaTimes, FaExchangeAlt, FaWallet } from "react-icons/fa";
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

interface AccountType { _id: string; name: string; }

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
}

const SearchableDropdown = ({
  label, placeholder, options, value, onChange, error, onPlusClick, plusLabel,
}: SearchableDropdownProps) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
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
          <Label>Account Name</Label>
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
const AddMoneyTransferForm = () => {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
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
      setDate(new Date().toLocaleDateString("en-CA")); setFromAccount(""); setToAccount(""); setTransactionDesction(""); setAmount(""); setVoucherNumber(""); setErrors({});
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add money transfer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard icon={<FaExchangeAlt />} title="Transfer Details" className="lg:col-span-2 self-start">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1">
                <DatePicker id="date-picker-transfer" label="Date" placeholder="Select a date"
                  defaultDate={date}
                  onChange={(_selectedDates: Date[], dateStr: string) => { setDate(dateStr); setErrors((p) => ({ ...p, date: "" })); }}
                />
                {errors.date && <p className="text-red-500 text-xs mt-0.5">{errors.date}</p>}
              </div>
              <div className="flex flex-col gap-1">
                <Label>Voucher Number</Label>
                <Input type="text" placeholder="Enter voucher number" value={voucherNumber}
                  onChange={(e) => { setVoucherNumber(e.target.value); setErrors((p) => ({ ...p, voucherNumber: "" })); }}
                  className={errors.voucherNumber ? "border-red-500" : ""}
                />
                {errors.voucherNumber && <p className="text-red-500 text-xs mt-0.5">{errors.voucherNumber}</p>}
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
                <Label>Amount</Label>
                <Input type="number" placeholder="Enter amount" value={amount}
                  onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: "" })); }}
                  className={errors.amount ? "border-red-500" : ""}
                />
                {errors.amount && <p className="text-red-500 text-xs mt-0.5">{errors.amount}</p>}
              </div>
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label>Transaction Description</Label>
                <Input type="text" placeholder="Enter description" value={transactionDesction}
                  onChange={(e) => { setTransactionDesction(e.target.value); setErrors((p) => ({ ...p, transactionDesction: "" })); }}
                  className={errors.transactionDesction ? "border-red-500" : ""}
                />
                {errors.transactionDesction && <p className="text-red-500 text-xs mt-0.5">{errors.transactionDesction}</p>}
              </div>
            </div>
          </SectionCard>
          <SectionCard icon={<FaWallet />} title="Summary" className="self-start">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">From</dt>
                <dd className="font-semibold text-gray-800 dark:text-white truncate">{accountOptions.find((o) => o.value === fromAccount)?.label || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">To</dt>
                <dd className="font-semibold text-gray-800 dark:text-white truncate">{accountOptions.find((o) => o.value === toAccount)?.label || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 pt-3">
                <dt className="text-gray-500 dark:text-gray-400">Amount</dt>
                <dd className="font-semibold tabular-nums text-accent-600 dark:text-accent-400">৳{Number(amount || 0).toLocaleString()}</dd>
              </div>
            </dl>
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
              "Add Money Transfer"
            )}
          </Button>
          </div>
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
