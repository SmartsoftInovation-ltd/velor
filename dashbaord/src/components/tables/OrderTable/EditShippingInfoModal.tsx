import { useState } from "react";
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
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
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h2 className="text-lg font-bold mb-4">Edit Shipping Info</h2>

        <div className="grid grid-cols-2 gap-4 py-5">
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
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Zone
            </label>
            <select
              name="deliveryZone"
              value={formData.deliveryZone || ""}
              onChange={handleChange}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="">-- Select Zone --</option>
              <option value="inside_dhaka">Inside Dhaka</option>
              <option value="outside_dhaka">Outside Dhaka</option>
              <option value="sub_area">Sub Area</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end mt-6 gap-x-2">
          <Button onClick={handleSubmit}>Save</Button>
          <Button
            onClick={onClose}
              className="bg-[#DCE8FF] text-[#1D4ED8] hover:bg-[#C7DAFF]"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
