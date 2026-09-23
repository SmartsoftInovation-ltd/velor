import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axios from "axios";
import { FaPlus, FaSearch, FaTimes, FaChevronDown } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import DatePicker from "../form/date-picker";
import MobileActionBar from "../common/MobileActionBar";
import { showApiError } from "../../utils/apiError";

interface Account { _id: string; name: string; }
interface TransactionCategory { _id: string; name: string; allowedType: "cash recived" | "cash payment"; }

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
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
  onPlusClick,
}: SearchableDropdownProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

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
            className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm text-left transition-colors ${
              error ? "border-red-500" : "border-gray-300 dark:border-gray-700"
            } ${open ? "ring-2 ring-brand-500/20 border-brand-500" : ""}`}
          >
            <span className={selected ? "text-gray-900 dark:text-white" : "text-gray-400"}>
              {selected ? selected.label : placeholder}
            </span>
            <FaChevronDown className={`size-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 transition-colors"
          >
            <FaTimes className="size-3" />
          </button>
        )}

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 size-3" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400 text-center">No results</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors ${
                      value === opt.value ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold" : "text-gray-700 dark:text-gray-300"
                    }`}
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
interface QuickAddModalProps {
  title: string;
  placeholder: string;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  requireType?: boolean;
  onSaveWithType?: (name: string, allowedType: "cash recived" | "cash payment") => Promise<void>;
}

const QuickAddModal = ({ title, placeholder, onClose, onSave, requireType, onSaveWithType }: QuickAddModalProps) => {
  const [name, setName] = useState("");
  const [allowedType, setAllowedType] = useState<"cash recived" | "cash payment" | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [typeError, setTypeError] = useState("");

  const handleSave = async () => {
    let hasError = false;
    if (!name.trim()) { setError(`${title} name is required.`); hasError = true; }
    if (requireType && !allowedType) { setTypeError("Transaction type is required."); hasError = true; }
    if (hasError) return;

    setSaving(true);
    try {
      if (requireType && onSaveWithType) {
        await onSaveWithType(name.trim(), allowedType as "cash recived" | "cash payment");
      } else {
        await onSave(name.trim());
      }
      onClose();
    } catch {
      setError(`Failed to create ${title.toLowerCase()}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add {title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <FaTimes className="size-4" />
          </button>
        </div>
        <div className="space-y-1">
          <Label>{title} Name</Label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder={placeholder}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors"
          />
          {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
        </div>
        {requireType && (
          <div className="space-y-1">
            <Label>Transaction Type</Label>
            <select
              value={allowedType}
              onChange={(e) => { setAllowedType(e.target.value as "cash recived" | "cash payment"); setTypeError(""); }}
              className={`w-full px-3 py-2.5 border rounded-lg dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors ${
                typeError ? "border-red-500" : "border-gray-300 dark:border-gray-700"
              }`}
            >
              <option value="">Select type...</option>
              <option value="cash recived">Cash Received</option>
              <option value="cash payment">Cash Payment</option>
            </select>
            {typeError && <p className="text-red-500 text-xs mt-0.5">{typeError}</p>}
          </div>
        )}
        <div className="flex gap-3">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
              className="flex-1 bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all"
          >
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
const AddTransactionForm = () => {
  const queryClient = useQueryClient();

  const todayStr = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    date: todayStr,
    transactionCategory: "",
    account: "",
    transactionDescription: "",
    transactionType: "",
    amount: "",
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [errors, setErrors] = useState<Partial<typeof formData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const fetchAccounts = async () => {
    const res = await axiosSecure.get("/account/all-account");
    setAccounts(res.data.data.accounts || []);
  };

  const fetchCategories = async () => {
    const res = await axiosSecure.get("/transaction-category/all-transition-category");
    setCategories(res.data.data.categories || []);
  };

  useEffect(() => {
    fetchAccounts().catch((error) => showApiError(error, "Failed to load accounts."));
    fetchCategories().catch((error) => showApiError(error, "Failed to load categories."));
  }, []);

  const handleSaveCategory = async (name: string, allowedType: "cash recived" | "cash payment") => {
    await axiosSecure.post("/transaction-category/create-transaction-category", {
      categories: [{ name, allowedType }],
    });
    toast.success(`Category "${name}" created!`);
    queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
    await fetchCategories();
  };

  const handleSaveAccount = async (name: string) => {
    await axiosSecure.post("/account/create-account", { accounts: [name] });
    toast.success(`Account "${name}" created!`);
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
    await fetchAccounts();
  };

  const setField = (field: string, value: string) => {
    setFormData((p) => {
      const next = { ...p, [field]: value };
      // category locks the transaction type — auto-set it and clear mismatch errors
      if (field === "transactionCategory") {
        const selectedCategory = categories.find((c) => c._id === value);
        next.transactionType = selectedCategory?.allowedType || "";
      }
      return next;
    });
    if (value) setErrors((p) => ({ ...p, [field]: undefined, transactionType: undefined }));
  };

  const handleSubmit = async () => {
    const e: Partial<typeof formData> = {};
    if (!formData.date) e.date = "Date is required.";
    if (!formData.transactionCategory) e.transactionCategory = "Category is required.";
    if (!formData.account) e.account = "Account is required.";
    if (!formData.transactionDescription) e.transactionDescription = "Description is required.";
    if (!formData.transactionType) e.transactionType = "Type is required.";
    if (!formData.amount || isNaN(Number(formData.amount))) e.amount = "Valid amount is required.";

    const selectedCategory = categories.find((c) => c._id === formData.transactionCategory);
    if (selectedCategory && formData.transactionType && selectedCategory.allowedType !== formData.transactionType) {
      e.transactionType = `"${selectedCategory.name}" only allows "${selectedCategory.allowedType}" transactions.`;
    }

    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setIsLoading(true);
    try {
      await axiosSecure.post("/transaction/create-transaction", {
        ...formData,
        amount: Number(formData.amount),
      });
      toast.success("Transaction created successfully!");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
      setFormData({ date: new Date().toISOString().slice(0, 10), transactionCategory: "", account: "", transactionDescription: "", transactionType: "", amount: "" });
      setErrors({});
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Failed to create transaction.");
      } else {
        toast.error("Failed to create transaction.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const categoryOptions = categories.map((c) => ({ value: c._id, label: c.name }));
  const accountOptions = accounts.map((a) => ({ value: a._id, label: a.name }));
  const selectedCategory = categories.find((c) => c._id === formData.transactionCategory);
  const typeOptions = selectedCategory
    ? [{ value: selectedCategory.allowedType, label: selectedCategory.allowedType === "cash recived" ? "Cash Received" : "Cash Payment" }]
    : [
        { value: "cash recived", label: "Cash Received" },
        { value: "cash payment", label: "Cash Payment" },
      ];

  return (
    <>
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Date */}
          <div className="flex flex-col gap-1">
            <Label>Date</Label>
            <DatePicker
              id="date-picker-transaction"
              placeholder="Select a date"
              defaultDate={formData.date}
              onChange={(_selectedDates: Date[], dateStr: string) => setField("date", dateStr)}
            />
            {errors.date && <p className="text-red-500 text-xs mt-0.5">{errors.date}</p>}
          </div>

          {/* Transaction Category */}
          <SearchableDropdown
            label="Transaction Category"
            placeholder="Select category..."
            options={categoryOptions}
            value={formData.transactionCategory}
            onChange={(val) => setField("transactionCategory", val)}
            error={errors.transactionCategory}
            onPlusClick={() => setShowCategoryModal(true)}
          />

          {/* Account */}
          <SearchableDropdown
            label="Account"
            placeholder="Select account..."
            options={accountOptions}
            value={formData.account}
            onChange={(val) => setField("account", val)}
            error={errors.account}
            onPlusClick={() => setShowAccountModal(true)}
          />

          {/* Transaction Type — locked to selected category's allowedType */}
          <SearchableDropdown
            label="Transaction Type"
            placeholder="Select category first..."
            options={typeOptions}
            value={formData.transactionType}
            onChange={(val) => setField("transactionType", val)}
            error={errors.transactionType}
          />

          {/* Amount */}
          <div className="flex flex-col gap-1">
            <Label>Amount</Label>
            <Input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={(e) => setField("amount", e.target.value)}
              placeholder="e.g. 15000"
              className={errors.amount ? "border-red-500" : ""}
            />
            {errors.amount && <p className="text-red-500 text-xs mt-0.5">{errors.amount}</p>}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1">
          <Label>Description</Label>
          <textarea
            name="transactionDescription"
            value={formData.transactionDescription}
            onChange={(e) => setField("transactionDescription", e.target.value)}
            placeholder="Enter transaction description"
            rows={3}
            className={`w-full px-3 py-2.5 border rounded-lg dark:bg-gray-800 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors ${
              errors.transactionDescription ? "border-red-500" : "border-gray-300 dark:border-gray-700"
            }`}
          />
          {errors.transactionDescription && (
            <p className="text-red-500 text-xs mt-0.5">{errors.transactionDescription}</p>
          )}
        </div>

        <MobileActionBar>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
              className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-8 py-2.5 rounded-xl font-semibold border-none shadow-lg active:scale-95 transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-[#1D4ED8]/30 border-t-[#1D4ED8]" />
                Submitting...
              </span>
            ) : (
              "Add Transaction"
            )}
          </Button>
        </MobileActionBar>
      </div>

      {showCategoryModal && (
        <QuickAddModal
          title="Transaction Category"
          placeholder="e.g. Sales Revenue"
          onClose={() => setShowCategoryModal(false)}
          onSave={async () => {}}
          requireType
          onSaveWithType={handleSaveCategory}
        />
      )}

      {showAccountModal && (
        <QuickAddModal
          title="Account"
          placeholder="e.g. Cash in Hand"
          onClose={() => setShowAccountModal(false)}
          onSave={handleSaveAccount}
        />
      )}
    </>
  );
};

export default AddTransactionForm;
