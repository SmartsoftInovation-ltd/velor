import { useEffect, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axios from "axios";
import { FaPlus, FaTimes, FaExchangeAlt, FaInfoCircle } from "react-icons/fa";
import axiosSecure from "../../hooks/useAxiosSecure";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import DatePicker from "../form/date-picker";
import MobileActionBar from "../common/MobileActionBar";
import SearchableSelect from "../form/SearchableSelect";
import SectionCard from "../common/SectionCard";
import { showApiError } from "../../utils/apiError";
import { useFormDraft, draftValue, clearDraft } from "../../hooks/useFormDraft";

// Unsaved input survives a reload or a trip to another page in this tab
// (sessionStorage, per store); cleared once the form is submitted.
const DRAFT_KEY = "add-transaction";

interface Account { _id: string; name: string; }
interface TransactionCategory { _id: string; name: string; allowedType: "cash recived" | "cash payment"; }

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
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <FaTimes className="size-4" />
          </button>
        </div>
        <div className="space-y-1">
          <Label>{title} Name <span className="text-red-500">*</span></Label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(""); }}
            placeholder={placeholder}
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg dark:bg-gray-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-colors"
          />
          {error && <p className="text-red-500 text-xs mt-0.5">{error}</p>}
        </div>
        {requireType && (
          <div className="space-y-1">
            <Label>Transaction Type <span className="text-red-500">*</span></Label>
            <SearchableSelect
              options={[
                { value: "cash recived", label: "Cash Received" },
                { value: "cash payment", label: "Cash Payment" },
              ]}
              value={allowedType}
              onChange={(v) => { setAllowedType(v as "cash recived" | "cash payment"); setTypeError(""); }}
              placeholder="Select type"
              searchPlaceholder="Search types..."
              hasError={!!typeError}
            />
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
              className="flex-1 !bg-accent-500 hover:!bg-accent-600 !text-white rounded-xl py-2.5 text-sm font-semibold border-none active:scale-95 transition-all"
          >
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
const AddTransactionForm = () => {
  const queryClient = useQueryClient();

  const todayStr = new Date().toLocaleDateString("en-CA");

  const [formData, setFormData] = useState(() => draftValue(DRAFT_KEY, "formData", {
    date: todayStr,
    transactionCategory: "",
    account: "",
    transactionDescription: "",
    voucherNumber: "",
    transactionType: "",
    amount: "",
  }));
  useFormDraft(
    DRAFT_KEY,
    useMemo(() => ({ formData }), [formData]),
  );

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
        voucherNumber: formData.voucherNumber.trim(),
        amount: Number(formData.amount),
      });
      toast.success("Transaction created successfully!");
      clearDraft(DRAFT_KEY);
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
      setFormData({ date: new Date().toLocaleDateString("en-CA"), transactionCategory: "", account: "", transactionDescription: "", voucherNumber: "", transactionType: "", amount: "" });
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
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionCard icon={<FaExchangeAlt />} title="Transaction Details" className="lg:col-span-2 self-start">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Date */}
              <div className="flex flex-col gap-1">
                <Label>Date <span className="text-red-500">*</span></Label>
                <DatePicker
                  id="date-picker-transaction"
                  placeholder="Select a date"
                  defaultDate={formData.date}
                  onChange={(_selectedDates: Date[], dateStr: string) => setField("date", dateStr)}
                />
                {errors.date && <p className="text-red-500 text-xs mt-0.5">{errors.date}</p>}
              </div>
              {/* Amount */}
              <div className="flex flex-col gap-1">
                <Label>Amount <span className="text-red-500">*</span></Label>
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
              {/* Transaction Category */}
              <SearchableDropdown
                label="Transaction Category"
                required
                placeholder="Select category..."
                options={categoryOptions}
                value={formData.transactionCategory}
                onChange={(val) => setField("transactionCategory", val)}
                error={errors.transactionCategory}
                onPlusClick={() => setShowCategoryModal(true)}
                plusLabel="Add transaction category"
              />
              {/* Account */}
              <SearchableDropdown
                label="Account"
                required
                placeholder="Select account..."
                options={accountOptions}
                value={formData.account}
                onChange={(val) => setField("account", val)}
                error={errors.account}
                onPlusClick={() => setShowAccountModal(true)}
                plusLabel="Add account"
              />
              {/* Transaction Type — locked to selected category's allowedType */}
              <SearchableDropdown
                label="Transaction Type"
                required
                placeholder="Select category first..."
                options={typeOptions}
                value={formData.transactionType}
                onChange={(val) => setField("transactionType", val)}
                error={errors.transactionType}
              />
              {/* Voucher Number */}
              <div className="flex flex-col gap-1">
                <Label>Voucher Number</Label>
                <Input
                  type="text"
                  name="voucherNumber"
                  value={formData.voucherNumber}
                  onChange={(e) => setField("voucherNumber", e.target.value)}
                  placeholder="e.g. VCH-0001 (optional)"
                />
              </div>
              {/* Description */}
              <div className="flex flex-col gap-1 md:col-span-2">
                <Label>Description <span className="text-red-500">*</span></Label>
                <textarea
                  name="transactionDescription"
                  value={formData.transactionDescription}
                  onChange={(e) => setField("transactionDescription", e.target.value)}
                  placeholder="Enter transaction description"
                  rows={3}
                  className={`w-full px-3 py-2.5 border rounded-lg dark:bg-gray-800 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500 transition-colors ${
                    errors.transactionDescription ? "border-red-500" : "border-gray-300 dark:border-gray-700"
                  }`}
                />
                {errors.transactionDescription && (
                  <p className="text-red-500 text-xs mt-0.5">{errors.transactionDescription}</p>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={<FaInfoCircle />} title="Summary" className="self-start">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                <dd>
                  {formData.transactionType ? (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${formData.transactionType === "cash recived" ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"}`}>
                      {formData.transactionType === "cash recived" ? "Cash In" : "Cash Out"}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-gray-500 dark:text-gray-400">Amount</dt>
                <dd className="font-semibold tabular-nums text-gray-800 dark:text-white">
                  ৳{Number(formData.amount || 0).toLocaleString()}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              The category decides whether this is cash in or cash out.
            </p>
          </SectionCard>
        </div>

        <MobileActionBar>
          <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
              className="!bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-2.5 !rounded-xl font-semibold border-none shadow-lg active:scale-95 transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Submitting...
              </span>
            ) : (
              "Add Transaction"
            )}
          </Button>
          </div>
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
