import { useEffect, useState } from "react";
import { Modal } from "../../ui/modal";
import Input from "../../form/input/InputField";
import Button from "../../ui/button/Button";
import axiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { showApiError } from "../../../utils/apiError";

interface EditShippingInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string | null;
  shippingInfo: any;
  fetchOrders: () => void;
}

export default function EditShippingInfoModal({
  isOpen,
  onClose,
  orderId,
  shippingInfo,
  fetchOrders,
}: EditShippingInfoModalProps) {
  const [formData, setFormData] = useState(shippingInfo || {});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The modal stays mounted, so reload the fields each time it opens —
  // otherwise it keeps showing whichever order it was first created with.
  useEffect(() => {
    if (isOpen) setFormData(shippingInfo || {});
  }, [isOpen, shippingInfo]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    // Guard against a second click while the first request is still running.
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (!orderId) return;

      await axiosSecure.put(`/order/order-update/${orderId}`, {
        shippingInfo: formData,
      });

      toast.success("Shipping info updated successfully.");
      fetchOrders();
      onClose();
    } catch (error) {
      console.error("Error updating order:", error);
      showApiError(error, "Failed to update order. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Edit Shipping Info</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-5">
          <Input
            name="fullName"
            value={formData.fullName || ""}
            onChange={handleChange}
            placeholder="Full Name"
          />
          <Input
            name="phone"
            value={formData.phone || ""}
            onChange={handleChange}
            placeholder="Phone"
          />
          <Input
            name="email"
            value={formData.email || ""}
            onChange={handleChange}
            placeholder="Email"
          />
          <Input
            name="address"
            value={formData.address || ""}
            onChange={handleChange}
            placeholder="Address"
          />
          <Input
            name="country"
            value={formData.country || ""}
            onChange={handleChange}
            placeholder="Country"
          />

          {/* Delivery Zone Dropdown */}
          <div className="md:col-span-2">
            <label htmlFor="ship-zone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Delivery Zone
            </label>
            <select
              id="ship-zone"
              name="deliveryZone"
              value={formData.deliveryZone || ""}
              onChange={handleChange}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-accent-300 focus:outline-none focus:ring-3 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">-- Select Zone --</option>
              <option value="inside_dhaka">Inside Dhaka</option>
              <option value="outside_dhaka">Outside Dhaka</option>
              <option value="sub_area">Sub Area</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <Button onClick={onClose} variant="outline" className="flex-1 rounded-xl py-2.5 text-sm">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 !bg-accent-500 hover:!bg-accent-600 !text-white !rounded-xl py-2.5 text-sm font-semibold"
          >
            {isSubmitting ? (
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
    </Modal>
  );
}
