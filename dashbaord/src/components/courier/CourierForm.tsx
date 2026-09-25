import { useState, useEffect } from "react";
import Button from "../ui/button/Button";
import Label from "../form/Label";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import MobileActionBar from "../common/MobileActionBar";
import { showApiError } from "../../utils/apiError";
import { scopedStorageKey } from "../../lib/session";

const couriers = ["Pathao", "SteadFast", "RedX", "PaperFly", "eCourier"];

interface CourierFormData {
  merchantID: string;
  merchantSecret: string;
  store_id: string;
  webhookSecret: string;
  baseURL: string;
}

const CourierForm = () => {
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [formData, setFormData] = useState<CourierFormData>({
    merchantID: "",
    merchantSecret: "",
    store_id: "",
    webhookSecret: "",
    baseURL: "",
  });

  // The webhook secret is typed in by the admin — secrets must never be baked
  // into the dashboard bundle.
  useEffect(() => {
    if (!selectedCourier) return;
    setFormData((prev) => ({ ...prev, webhookSecret: "" }));
  }, [selectedCourier]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedCourier) return alert("Please select a courier first!");

    const payload = {
      merchantID: formData.merchantID,
      merchantSecret: formData.merchantSecret,
      store_id: formData.store_id,
      webhookSecret: formData.webhookSecret,
      baseURL: formData.baseURL,
      serviceProvider: selectedCourier.toLowerCase(),
    };

    try {
      const res = await axiosSecure.post(`/merchant/create-merchant`, payload);

      // Assuming API returns the saved merchant object with _id
      const merchant = res.data.data;

      // Remembered per store: unscoped, this id followed the browser into the
      // next store and was posted as that store's merchant.
      if (merchant?._id) {
        localStorage.setItem(
          scopedStorageKey(`merchantId_${selectedCourier.toLowerCase()}`),
          merchant._id
        );
        toast.success(`${selectedCourier} merchant created and saved locally!`);
      } else {
        toast.success("Merchant created successfully!");
      }
    } catch (error: any) {
      showApiError(error, "Something went wrong!");
    }
  };

  const fields: Record<keyof CourierFormData, { label: string; type: string }> = {
    merchantID: { label: "Merchant ID", type: "text" },
    merchantSecret: { label: "Merchant Secret", type: "text" },
    store_id: { label: "Store ID", type: "text" },
    baseURL: { label: "Base URL", type: "text" },
    webhookSecret: { label: "Webhook Secret", type: "password" },
  };

  return (
    <div className="py-3">
      <div className="flex flex-wrap gap-3 mb-6">
        {couriers.map((c) => (
          <Button
            key={c}
            onClick={() => setSelectedCourier(c)}
            variant={selectedCourier === c ? "primary" : "outline"}
            className={`px-4 py-2 rounded-md border transition ${
              selectedCourier === c
                ? "bg-brand-500 border-brand-500 text-white"
                : "bg-gray-50 border-gray-50 text-black hover:bg-gray-50"
            }`}
          >
            {c}
          </Button>
        ))}
      </div>

      {selectedCourier && (
        <form onSubmit={handleSubmit} className="space-y-4 py-4 rounded-md">
          <h3 className="text-lg font-semibold mb-2">
            {selectedCourier} Integration Form
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(fields).map(([key, { label, type }]) => (
              <div key={key}>
                <Label>{label}</Label>
                <input
                  type={type}
                  name={key}
                  value={formData[key as keyof CourierFormData]}
                  onChange={handleChange}
                  className="w-full border px-3 py-2 rounded-md"
                />
              </div>
            ))}

            {/* The single-tenant /courier/<provider>-webhook URLs were removed:
                each store now has its own webhook URL, shown in
                Settings -> Store Settings -> the courier's card. */}
            <div>
              <Label>Webhook Integration URL</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your store's webhook URL is shown in Settings &rarr; Store Settings, on this
                courier's card. Paste that one into the courier portal.
              </p>
            </div>
          </div>

          <MobileActionBar>
            <Button
              //@ts-ignore
              type="submit"
                className="bg-[#D5F0E3] text-[#0A6B43] px-4 py-2 rounded-md"
            >
              Save {selectedCourier}
            </Button>
          </MobileActionBar>
        </form>
      )}
    </div>
  );
};

export default CourierForm;
