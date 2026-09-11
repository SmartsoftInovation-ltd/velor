import axiosSecure from "../../hooks/useAxiosSecure";
import { ChangeEvent, FormEvent, useState } from "react";
import toast from "react-hot-toast";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import { Link } from "react-router";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import { showApiError } from "../../utils/apiError";

const AddAccount = () => {
  const [accounts, setAccounts] = useState<string[]>([""]);
  const [errors, setErrors] = useState<string[]>([""]);

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
            <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
              Account List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            {accounts.map((account, index) => (
              <div key={index} className="flex flex-col gap-1">
                <Input
                  type="text"
                  value={account}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    handleAccountChange(index, e.target.value)
                  }
                  placeholder={`Account ${index + 1}`}
                  className={`w-full md:!w-[300px] px-3 py-2 rounded border ${
                    errors[index]
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-300 dark:border-gray-700"
                  } bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2`}
                />
                {errors[index] && (
                  <p className="text-red-500 text-sm">{errors[index]}</p>
                )}
              </div>
            ))}

            <div className="flex gap-4 mt-4">
              <Button className="text-white px-4 py-2 rounded">Submit</Button>
            </div>
          </form>
        </ComponentCard>
      </div>
    </div>
  );
};

export default AddAccount;
