import axiosSecure from "../../hooks/useAxiosSecure";
import { ChangeEvent, FormEvent, useState } from "react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import SectionCard from "../../components/common/SectionCard";
import MobileActionBar from "../../components/common/MobileActionBar";
import Label from "../../components/form/Label";
import { FaUniversity, FaPlus, FaTrash } from "react-icons/fa";
import { Link } from "react-router";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import { showApiError } from "../../utils/apiError";

const AddAccount = () => {
  const [accounts, setAccounts] = useState<string[]>([""]);
  const [errors, setErrors] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddField = () => {
    setAccounts((prev) => [...prev, ""]);
    setErrors((prev) => [...prev, ""]);
  };

  const handleRemoveField = (index: number) => {
    setAccounts((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAccountChange = (index: number, value: string) => {
    const updatedAccounts = [...accounts];
    updatedAccounts[index] = value;
    setAccounts(updatedAccounts);

    // remove error if user starts typing
    const updatedErrors = [...errors];
    updatedErrors[index] = "";
    setErrors(updatedErrors);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validation check
    const newErrors = accounts.map((acc) =>
      acc.trim() === "" ? "Account name is required" : ""
    );
    setErrors(newErrors);

    // If any error exists, stop form submission
    if (newErrors.some((err) => err !== "")) {
      toast.error("Please fill in all account fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await axiosSecure.post(`/account/create-account`, {
        accounts,
      });
      if (res.status === 200) {
        toast.success("Account(s) created successfully!");
        setAccounts([""]);
        setErrors([""]);
      }
    } catch (error) {
      console.error(error);
      showApiError(error, "Failed to create account(s)");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Create Account"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/account-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Account List
            </Button>
          </Link>
        }
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <SectionCard
          icon={<FaUniversity />}
          title="Accounts"
          action={
            <button
              type="button"
              onClick={handleAddField}
              className="shine inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent-100 bg-accent-50 hover:bg-accent-100 text-accent-600 dark:border-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400 text-xs font-semibold transition-colors"
            >
              <FaPlus className="size-3" />
              Add Another
            </button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {accounts.map((account, index) => (
              <div key={index} className="flex flex-col gap-1">
                <Label htmlFor={`account-${index}`}>Account Name {accounts.length > 1 ? index + 1 : ""}</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      id={`account-${index}`}
                      type="text"
                      value={account}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        handleAccountChange(index, e.target.value)
                      }
                      placeholder="e.g. Cash in Hand, bKash, City Bank"
                      className={errors[index] ? "border-red-500" : ""}
                    />
                  </div>
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField(index)}
                      aria-label={`Remove account ${index + 1}`}
                      className="shine flex size-10 shrink-0 items-center justify-center rounded border-none transition-all active:scale-90 bg-error-50 text-error-600 hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
                    >
                      <FaTrash className="size-4" />
                    </button>
                  )}
                </div>
                {errors[index] && (
                  <p className="text-red-500 text-xs mt-0.5">{errors[index]}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        <MobileActionBar>
          <div className="flex justify-end pt-2">
            <Button
              disabled={isSubmitting}
              className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold px-8 py-2.5 !rounded-xl disabled:opacity-60"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating...
                </span>
              ) : (
                "Create Account"
              )}
            </Button>
          </div>
        </MobileActionBar>
      </form>
    </div>
  );
};

export default AddAccount;
