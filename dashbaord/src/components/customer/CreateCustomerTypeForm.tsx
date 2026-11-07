import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosSecure from "../../hooks/useAxiosSecure";
import { showApiError } from "../../utils/apiError";
import MobileActionBar from "../common/MobileActionBar";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";

const CreateCustomerTypeForm = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const customerType = name.trim();
    if (!customerType) {
      setError("Customer type name is required.");
      return;
    }

    setIsLoading(true);
    try {
      await axiosSecure.post("/customer/create-customertype", { customerType });
      toast.success("Customer type created successfully");
      queryClient.invalidateQueries({ queryKey: ["customer-types"] });
      navigate("/customer-type-list");
    } catch (err) {
      showApiError(err, "Failed to create customer type");
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm w-full space-y-6"
    >
      <div>
        <Label htmlFor="customerType" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">
          Customer Type Name <span className="text-red-500">*</span>
        </Label>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) setError("");
          }}
          type="text"
          id="customerType"
          placeholder="Enter customer type name"
          className={error ? "border-red-500" : ""}
        />
        {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
      </div>

      <MobileActionBar>
        <div className="flex justify-end pt-2">
          <Button
            className="w-full sm:w-auto !bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 !rounded-xl transition-all duration-200 shadow-theme-md font-semibold text-sm active:scale-95 disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              "Create Customer Type"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </form>
  );
};

export default CreateCustomerTypeForm;
