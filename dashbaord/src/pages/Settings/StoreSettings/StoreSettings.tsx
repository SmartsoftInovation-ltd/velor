import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { useAuth, type Features } from "../../../context/AuthContext";
import { isFeatureEnabled } from "../../../components/routes/FeatureGate";

interface GeneralSettings {
  invoicePrefix: string;
  orderHotline: string;
  facebookUrl: string;
  storefrontUrl: string;
  currency: string;
  timezone: string;
}

interface Webhooks {
  sslcommerz: Record<string, string>;
  pathao: string;
  steadfast: string;
}

const INTEGRATIONS: { label: string; feature: Parameters<typeof isFeatureEnabled>[1] }[] = [
  { label: "SMS", feature: "sms" },
  { label: "Email", feature: "email" },
  { label: "Online payment (SSLCommerz)", feature: "sslcommerz" },
  { label: "Pathao courier", feature: "couriers.pathao" },
  { label: "Steadfast courier", feature: "couriers.steadfast" },
  { label: "Cloudinary (images)", feature: "cloudinary" },
  { label: "AI assistant (Groq)", feature: "ai" },
];

const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 read-only:bg-gray-50 read-only:text-gray-500 dark:border-gray-700 dark:text-white/90 dark:read-only:bg-white/[0.03]";

// Store profile as seen by the store: integrations are connected by the platform,
// the owner may edit the contact fields shown to customers.
const StoreSettings = () => {
  const { isOwner } = useAuth();
  const [general, setGeneral] = useState<GeneralSettings | null>(null);
  const [features, setFeatures] = useState<Features | null>(null);
  const [webhooks, setWebhooks] = useState<Webhooks | null>(null);
  const [form, setForm] = useState({ orderHotline: "", facebookUrl: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [settingsRes, webhooksRes] = await Promise.all([
          axiosSecure.get("/settings"),
          axiosSecure.get("/settings/webhooks"),
        ]);
        if (!active) return;
        const data = settingsRes.data.data;
        setGeneral(data.settings.general);
        setFeatures(data.features);
        setForm({ orderHotline: data.settings.general.orderHotline || "", facebookUrl: data.settings.general.facebookUrl || "" });
        setWebhooks(webhooksRes.data.data);
      } catch {
        toast.error("Could not load store settings");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await axiosSecure.patch("/settings/general", form);
      toast.success("Store settings saved");
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(message || "Could not save store settings");
    } finally {
      setSaving(false);
    }
  };

  if (!general) return <p className="p-6 text-sm text-gray-500">Loading store settings…</p>;

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Store profile</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="invoicePrefix" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Invoice prefix</label>
            <input id="invoicePrefix" className={inputClass} value={general.invoicePrefix} readOnly />
            <p className="mt-1 text-xs text-gray-500">Set by support</p>
          </div>
          <div>
            <label htmlFor="orderHotline" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Order hotline</label>
            <input
              id="orderHotline"
              className={inputClass}
              value={form.orderHotline}
              readOnly={!isOwner}
              placeholder="01XXXXXXXXX"
              onChange={(e) => setForm((prev) => ({ ...prev, orderHotline: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="facebookUrl" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400">Facebook page</label>
            <input
              id="facebookUrl"
              className={inputClass}
              value={form.facebookUrl}
              readOnly={!isOwner}
              placeholder="https://facebook.com/your-store"
              onChange={(e) => setForm((prev) => ({ ...prev, facebookUrl: e.target.value }))}
            />
          </div>
        </div>
        {isOwner && (
          <button
            type="submit"
            disabled={saving}
            className="mt-5 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
      </form>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">Integrations</h2>
        <ul aria-label="Integrations" className="divide-y divide-gray-100 dark:divide-gray-800">
          {INTEGRATIONS.map(({ label, feature }) => {
            const enabled = isFeatureEnabled(features, feature);
            return (
              <li key={feature} className="flex items-center justify-between py-3 text-sm">
                <span className="text-gray-700 dark:text-gray-300">{label}</span>
                <span className={enabled ? "text-success-600" : "text-gray-400"}>{enabled ? "Configured" : "Not configured"}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-gray-500">Integrations are connected by support. Contact support to add or change an account.</p>
      </section>

      {webhooks && (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">Webhook URLs</h2>
          <p className="mb-4 text-xs text-gray-500">Paste these into your courier and payment provider panels.</p>
          <dl className="space-y-3 text-sm">
            {[
              ["Pathao", webhooks.pathao],
              ["Steadfast", webhooks.steadfast],
              ["SSLCommerz IPN", webhooks.sslcommerz.ipn],
            ].map(([name, url]) => (
              <div key={name}>
                <dt className="font-medium text-gray-700 dark:text-gray-300">{name}</dt>
                <dd className="break-all font-mono text-xs text-gray-500">{url}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
};

export default StoreSettings;
