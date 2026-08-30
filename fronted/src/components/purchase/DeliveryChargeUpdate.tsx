import { useEffect, useState, ChangeEvent } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import axiosInstance from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import { showApiError } from "../../utils/apiError";

interface FormData {
  name: string;
  deliveryCharge: string;
}

interface FormErrors {
  name?: string;
  deliveryCharge?: string;
}

const DeliveryChargeUpdate = () => {
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    deliveryCharge: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axiosInstance.get(
          `/delivery-charge/get-single-delivery-charge/${id}`
        );

        setFormData({
          name: data?.data?.name || "",
          deliveryCharge: String(data?.data?.deliveryCharge || ""),
        });
      } catch (error) {
        showApiError(error, "Failed to load delivery charge data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
    setErrors({ ...errors, [e.target.id]: "" });
  };

  const handleUpdate = async () => {
    const validate: FormErrors = {};

    if (!formData.name.trim()) {
      validate.name = "Delivery name is required";
    }

    if (!String(formData.deliveryCharge).trim()) {
      validate.deliveryCharge = "Delivery charge is required";
    }

    if (Object.keys(validate).length > 0) {
      setErrors(validate);
      return;
    }

    try {
      await axiosInstance.put(`/delivery-charge/update-delivery-charge/${id}`, {
        name: formData.name,
        deliveryCharge: Number(formData.deliveryCharge),
      });

      toast.success("Delivery Charge Updated Successfully");
    } catch (error) {
      console.log(error);
      showApiError(error, "Failed to update delivery charge");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb pageTitle="Update Delivery Charge" />
      <div className="space-y-6">
        <ComponentCard
          title={
            <div className="flex justify-between items-center">
              <h2 className="text-md font-medium">Update Purchase Return</h2>
              <Link to="/delivery-charge-list">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                  Delivery Charge List
                </Button>
              </Link>
            </div>
          }
        >
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
                <p className="text-red-500 text-sm mt-1">
                  {errors.deliveryCharge}
                </p>
              )}
            </div>

            <Button onClick={handleUpdate}>Update Delivery Charge</Button>
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default DeliveryChargeUpdate;
