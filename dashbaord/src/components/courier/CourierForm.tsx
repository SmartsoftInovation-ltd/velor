import { useState, useEffect } from "react";
import Button from "../ui/button/Button";
import Label from "../form/Label";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import MobileActionBar from "../common/MobileActionBar";
import { showApiError } from "../../utils/apiError";

const couriers = ["Pathao", "SteadFast", "RedX", "PaperFly", "eCourier"];

interface CourierFormData {
  merchantID: string;
  merchantSecret: string;
  store_id: string;
  webhookSecret: string;
  baseURL: string;
  webhookIntegrationeURL: string;
}

const CourierForm = () => {
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [formData, setFormData] = useState<CourierFormData>({
    merchantID: "",
    merchantSecret: "",
    store_id: "",
    webhookSecret: "",
    baseURL: "",
    webhookIntegrationeURL: "",
  });

  // Set webhook secret and integration URL when courier changes
  useEffect(() => {
    if (!selectedCourier) return;

    const courierSlug = selectedCourier.toLowerCase();

    const envSecrets: Record<string, string> = {
      pathao: import.meta.env.VITE_PATHAO_WEBHOOK_SECRET || "",
      steadfast: import.meta.env.VITE_STEADFAST_WEBHOOK_SECRET || "",
      redx: import.meta.env.VITE_REDX_WEBHOOK_SECRET || "",
      paperfly: import.meta.env.VITE_PAPERFLY_WEBHOOK_SECRET || "",
      ecourier: import.meta.env.VITE_ECOURIER_WEBHOOK_SECRET || "",
    };

    setFormData((prev) => ({
      ...prev,
      webhookSecret: envSecrets[courierSlug] || "",
      webhookIntegrationeURL: `${
        import.meta.env.VITE_API_URL
      }/courier/${courierSlug}-webhook`,
    }));
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

      // Save to localStorage
      if (merchant?._id) {
        localStorage.setItem(
          `merchantId_${selectedCourier.toLowerCase()}`,
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

  const fields: Record<
    keyof Omit<CourierFormData, "webhookIntegrationeURL" | "webhookSecret">,
    { label: string; type: string }
  > = {
    merchantID: { label: "Merchant ID", type: "text" },
    merchantSecret: { label: "Merchant Secret", type: "text" },
    store_id: { label: "Store ID", type: "text" },
    baseURL: { label: "Base URL", type: "text" },
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
                ? "bg-blue-500 border-blue-500 text-white"
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

            {/* Webhook Secret (Readonly) */}
            <div>
              <Label>Webhook Secret</Label>
              <input
                type="text"
                value={formData.webhookSecret}
                readOnly
                className="w-full border px-3 py-2 rounded-md bg-gray-100 text-gray-600"
              />
            </div>

            {/* Webhook Integration URL (Readonly) */}
            <div>
              <Label>Webhook Integration URL</Label>
              <input
                type="text"
                value={formData.webhookIntegrationeURL}
                readOnly
                className="w-full border px-3 py-2 rounded-md bg-gray-100 text-gray-600"
              />
            </div>
          </div>

          <MobileActionBar>
            <Button
              //@ts-ignore
              type="submit"
                className="bg-[#DCE8FF] text-[#1D4ED8] px-4 py-2 rounded-md"
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
