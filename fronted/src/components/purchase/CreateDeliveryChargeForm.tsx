import { useState, ChangeEvent } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
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

  const [errors, setErrors] = useState<FormErrors>({});

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
    setErrors({ ...errors, [e.target.id]: "" });
  };

  const handleSubmit = async () => {
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
    }
  };

  return (
    <div>
      {/* Name */}
      <div className="mb-4">
        <Label htmlFor="name"> Name:</Label>
        <Input
          type="text"
          id="name"
          placeholder="Enter Delivery name"
          value={formData.name}
          onChange={handleChange}
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name}</p>
        )}
      </div>

      {/* Delivery Charge */}
      <div className="mb-4">
        <Label htmlFor="deliveryCharge"> Delivery Charge:</Label>
        <Input
          type="text"
          id="deliveryCharge"
          placeholder="Enter Delivery Charge"
          value={formData.deliveryCharge}
          onChange={handleChange}
        />
        {errors.deliveryCharge && (
          <p className="text-red-500 text-sm mt-1">{errors.deliveryCharge}</p>
        )}
      </div>

      <Button
        className="bg-[#DCE8FF] hover:bg-[#C7DAFF] text-[#1D4ED8] px-4 py-2 rounded"
        onClick={handleSubmit}
      >
        Create Delivery Charge
      </Button>
    </div>
  );
};

export default CreateDeliveryChargeForm;
