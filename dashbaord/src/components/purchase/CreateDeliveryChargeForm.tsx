import { useState, ChangeEvent } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import MobileActionBar from "../common/MobileActionBar";
import axiosInstance from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { showApiError } from "../../utils/apiError";

interface FormData {
  name: string;
  deliveryCharge: string;
}

interface FormErrors {
  name?: string;
  deliveryCharge?: string;
}

const CreateDeliveryChargeForm = () => {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    deliveryCharge: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
    setErrors({ ...errors, [e.target.id]: "" });
  };

  const handleSubmit = async () => {

    // Guard against a second click while the first request is still running.

    if (isSubmitting) return;
    const validate: FormErrors = {};

    if (!formData.name.trim()) {
      validate.name = "Delivery name is required";
    }
    if (!formData.deliveryCharge.trim()) {
      validate.deliveryCharge = "Delivery charge is required";
    }

    if (Object.keys(validate).length > 0) {
      setErrors(validate);
      return;
    }

    setIsSubmitting(true);

    try {
      await axiosInstance.post(
        `/delivery-charge/create-delivery-charge`,
        formData
      );
      toast.success("Delivery Charge Created Successfully");
      setFormData({ name: "", deliveryCharge: "" });
    } catch (error) {
      console.log(error);
      showApiError(error, "Failed to create delivery charge");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-theme-sm w-full space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <Label htmlFor="name" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">Delivery Name</Label>
          <Input
            type="text"
            id="name"
            placeholder="Enter delivery name"
            value={formData.name}
            onChange={handleChange}
            className={errors.name ? "border-red-500" : ""}
          />
          {errors.name && (
            <p role="alert" className="text-red-500 text-xs mt-1 font-medium">{errors.name}</p>
          )}
        </div>
        <div>
          <Label htmlFor="deliveryCharge" className="text-gray-700 dark:text-gray-300 font-semibold mb-1.5 block">Delivery Charge (৳)</Label>
          <Input
            type="text"
            id="deliveryCharge"
            placeholder="Enter delivery charge"
            value={formData.deliveryCharge}
            onChange={handleChange}
            className={errors.deliveryCharge ? "border-red-500" : ""}
          />
          {errors.deliveryCharge && (
            <p role="alert" className="text-red-500 text-xs mt-1 font-medium">{errors.deliveryCharge}</p>
          )}
        </div>
      </div>
      <MobileActionBar>
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full sm:w-auto !bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 !rounded-xl font-semibold text-sm active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </span>
            ) : (
              "Create Delivery Charge"
            )}
          </Button>
        </div>
      </MobileActionBar>
    </div>
  );
};

export default CreateDeliveryChargeForm;
