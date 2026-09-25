import { useEffect, useState, ChangeEvent } from "react";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import axiosInstance from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { Link, useParams } from "react-router";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import MobileActionBar from "../common/MobileActionBar";
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
  const [isUpdating, setIsUpdating] = useState(false);

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

    // Guard against a second click while the first request is still running.

    if (isUpdating) return;
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

    setIsUpdating(true);

    try {
      await axiosInstance.put(`/delivery-charge/update-delivery-charge/${id}`, {
        name: formData.name,
        deliveryCharge: Number(formData.deliveryCharge),
      });

      toast.success("Delivery Charge Updated Successfully");
    } catch (error) {
      console.log(error);
      showApiError(error, "Failed to update delivery charge");
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading)
    return (
      <div role="status" className="flex justify-center py-20">
        <div className="size-10 border-4 border-accent-500/20 border-t-accent-500 rounded-full animate-spin" />
      </div>
    );

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      <PageBreadcrumb
        pageTitle="Update Delivery Charge"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/delivery-charge-list">
            <Button className="!bg-accent-500 hover:!bg-accent-600 !text-white font-semibold text-sm px-4 py-2 rounded">
              Delivery Charge List
            </Button>
          </Link>
        }
      />
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
              onClick={handleUpdate}
              disabled={isUpdating}
              className="w-full sm:w-auto !bg-accent-500 hover:!bg-accent-600 !text-white px-8 py-3 !rounded-xl font-semibold text-sm active:scale-95 disabled:opacity-50"
            >
              {isUpdating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Updating...
                </span>
              ) : (
                "Update Delivery Charge"
              )}
            </Button>
          </div>
        </MobileActionBar>
      </div>
    </>
  );
};

export default DeliveryChargeUpdate;
