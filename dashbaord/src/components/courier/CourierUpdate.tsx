import { useState, useEffect } from "react";
import { Link, useParams } from "react-router";
import Button from "../ui/button/Button";
import Label from "../form/Label";
import axiosSecure from "../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import PageMeta from "../common/PageMeta";
import PageBreadcrumb from "../common/PageBreadCrumb";
import ComponentCard from "../common/ComponentCard";
import MobileActionBar from "../common/MobileActionBar";
import { showApiError } from "../../utils/apiError";
import { apiUrl } from "../../lib/env";

const couriers = ["Pathao", "SteadFast", "RedX", "PaperFly", "eCourier"];

interface CourierFormData {
  merchantID: string;
  merchantSecret: string;
  store_id: string | number;
  webhookSecret: string;
  baseURL: string;
  serviceProvider?: string;
}

const CourierUpdate = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null);
  const [formData, setFormData] = useState<CourierFormData>({
    merchantID: "",
    merchantSecret: "",
    store_id: "",
    webhookSecret: "",
    baseURL: "",
  });

  const [webhookIntegrationeURL, setWebhookIntegrationeURL] = useState("");

  useEffect(() => {
    const fetchMerchant = async () => {
      try {
        const res = await axiosSecure.get(`/merchant/get-merchant/${id}`);
        const data = res.data.data;

        setFormData({
          merchantID: data.merchantID,
          merchantSecret: data.merchantSecret,
          store_id: data.store_id,
          webhookSecret: data.webhookSecret,
          baseURL: data.baseURL,
          serviceProvider: data.serviceProvider,
        });

        setWebhookIntegrationeURL(
          `${apiUrl()}/courier/${
            data.serviceProvider
          }-webhook`
        );

        setSelectedCourier(data.serviceProvider);
      } catch (error) {
        showApiError(error, "Failed to fetch merchant details!");
      }
    };

    fetchMerchant();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const { serviceProvider, ...dataToSend } = formData;

      await axiosSecure.put(`/merchant/update-merchant/${id}`, {
        ...dataToSend,
        serviceProvider: selectedCourier?.toLowerCase(),
      });

      toast.success("Merchant updated successfully!");
    } catch (error) {
      showApiError(error, "Update failed!");
    }
  };

  const fields: Record<
    keyof Omit<CourierFormData, "serviceProvider">,
    { label: string; type: string }
  > = {
    merchantID: { label: "Merchant ID", type: "text" },
    merchantSecret: { label: "Merchant Secret", type: "text" },
    store_id: { label: "Store ID", type: "text" },
    webhookSecret: { label: "Webhook Secret", type: "text" },
    baseURL: { label: "Base URL", type: "text" },
  };

  return (
    <>
      <PageMeta
        title="Baig Ecommerce Admin Dashboard"
        description="This is React.js Ecommerce Dashboard page for Baig Digital"
      />
      {/* Header row is just the trail and the list button — the card carries no
          second heading of its own. */}
      <PageBreadcrumb
        pageTitle="Update Merchant"
        className="mb-3"
        hideTitle
        actions={
          <Link to="/courier-merchant-list">
            <Button className="!bg-[#DCE8FF] hover:!bg-[#C7DAFF] !text-[#1D4ED8] font-normal text-sm px-4 py-2 rounded">
              Courier Merchant List
            </Button>
          </Link>
        }
      />
      <div className="space-y-6">
        <ComponentCard>
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
              <form
                onSubmit={handleSubmit}
                className="space-y-4 py-4 rounded-md"
              >
                <h3 className="text-lg font-semibold mb-2">
                  Edit {selectedCourier} Integration
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

                  {/* Webhook Integration URL (Readonly) */}
                  <div>
                    <Label>Webhook Integration URL</Label>
                    <input
                      type="text"
                      value={webhookIntegrationeURL}
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
                    Update {selectedCourier}
                  </Button>
                </MobileActionBar>
              </form>
            )}
          </div>
        </ComponentCard>
      </div>
    </>
  );
};

export default CourierUpdate;
