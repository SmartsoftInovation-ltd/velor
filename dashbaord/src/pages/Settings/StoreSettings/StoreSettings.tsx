import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiCheck, FiCopy, FiInfo, FiLink, FiX } from "react-icons/fi";
import { HiOutlineBuildingStorefront } from "react-icons/hi2";
import axiosSecure from "../../../hooks/useAxiosSecure";
import { useAuth, type Features } from "../../../context/AuthContext";
import IntegrationForm from "./IntegrationForm";
import { GROUP_ORDER, INTEGRATIONS } from "./integrationMeta";
import type { SectionSchema, SectionValues, TestResult } from "./types";

interface SettingsResponse {
  settings: Record<string, SectionValues>;
  features: Features;
  canManageIntegrations: boolean;
}

interface Webhooks {
  sslcommerz: Record<string, string>;
  pathao: string;
  steadfast: string;
}

const card = "rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]";

const StatusPill = ({ connected }: { connected: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
      connected
        ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
        : "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"
    }`}
  >
    <span className={`size-1.5 rounded-full ${connected ? "bg-success-500" : "bg-gray-400"}`} />
    {connected ? "Connected" : "Not connected"}
  </span>
);

const CopyRow = ({ name, url }: { name: string; url: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(`${name} URL copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — select the URL and copy it manually");
    }
  };

  return (
    <div className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-36 shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">{name}</span>
      <code className="min-w-0 flex-1 truncate rounded-lg bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 dark:bg-white/[0.03] dark:text-gray-400" title={url}>
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${name} webhook URL`}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-gray-800 dark:hover:bg-white/5"
      >
        {copied ? <FiCheck className="size-4 text-success-600" /> : <FiCopy className="size-4" />}
      </button>
    </div>
  );
};

// Right-side panel with the configuration form of one integration
const IntegrationPanel = ({ section, onClose, children }: { section: SectionSchema; onClose: () => void; children: React.ReactNode }) => {
  const meta = INTEGRATIONS[section.key];
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-99999 flex justify-end">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${meta?.title ?? section.key} settings`}
        className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl dark:bg-gray-900"
      >
        <header className="flex items-start gap-3 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            {meta?.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{meta?.title ?? section.key}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{meta?.description}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:hover:bg-white/5"
          >
            <FiX className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </section>
    </div>
  );
};

const StoreSettings = () => {
  const { tenant, updateFeatures } = useAuth();
  const [schema, setSchema] = useState<SectionSchema[]>([]);
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [webhooks, setWebhooks] = useState<Webhooks | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const loadSettings = useCallback(async () => {
    const res = await axiosSecure.get("/settings");
    setData(res.data.data);
    return res.data.data as SettingsResponse;
  }, []);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const [schemaRes, , webhooksRes] = await Promise.all([
        axiosSecure.get("/settings/schema"),
        loadSettings(),
        axiosSecure.get("/settings/webhooks"),
      ]);
      setSchema(schemaRes.data.data);
      setWebhooks(webhooksRes.data.data);
    } catch {
      setLoadError(true);
    }
  }, [loadSettings]);

  useEffect(() => {
    load();
  }, [load]);

  const closePanel = useCallback(() => setOpenKey(null), []);

  if (loadError) {
    return (
      <div className={`${card} p-8 text-center`}>
        <p className="text-sm text-gray-600 dark:text-gray-400">Store settings could not be loaded.</p>
        <button type="button" onClick={load} className="mt-3 text-sm font-medium text-brand-600 hover:underline">Try again</button>
      </div>
    );
  }

  if (!data || !schema.length) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className={`${card} h-28 animate-pulse`} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className={`${card} h-40 animate-pulse`} />)}
        </div>
      </div>
    );
  }

  const canManage = data.canManageIntegrations;
  const sections = schema.filter((section) => INTEGRATIONS[section.key]);
  const connectedCount = sections.filter((section) => INTEGRATIONS[section.key].connected(data.features)).length;
  const openSection = sections.find((section) => section.key === openKey);

  const save = async (section: SectionSchema, patch: Record<string, unknown>) => {
    const res = await axiosSecure.patch(`/settings/${section.path}`, patch);
    const changes: string[] = res.data?.data?.changes ?? [];
    const fresh = await loadSettings();
    updateFeatures(fresh.features);
    setVersion((v) => v + 1);
    toast.success(changes.length ? `${INTEGRATIONS[section.key].title} settings saved` : "Nothing changed");
  };

  const test = async (section: SectionSchema): Promise<TestResult> => {
    const res = await axiosSecure.post(`/settings/${section.path}/test`);
    return res.data.data;
  };

  return (
    <div className="space-y-6">
      {/* Store summary */}
      <section className={`${card} flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between`}>
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-2xl text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <HiOutlineBuildingStorefront />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{tenant?.name ?? "Your store"}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1"><FiLink className="size-3.5" />Workspace</span>
              <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700 dark:bg-white/5 dark:text-gray-300">{tenant?.slug}</code>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div>
            <label htmlFor="invoicePrefix" className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Invoice prefix</label>
            <input
              id="invoicePrefix"
              readOnly
              value={data.settings.general?.invoicePrefix as string}
              className="h-9 w-24 rounded-lg border border-gray-200 bg-gray-50 px-3 font-mono text-sm text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300"
            />
          </div>
          <div className="min-w-[10rem]">
            <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">Integrations</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-white/90">{`${connectedCount} of ${sections.length} connected`}</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
              <div className="h-full rounded-full bg-success-500 transition-all" style={{ width: `${(connectedCount / sections.length) * 100}%` }} />
            </div>
          </div>
        </div>
      </section>

      {!canManage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-light-200 bg-blue-light-50 px-4 py-3 text-sm text-blue-light-700 dark:border-blue-light-500/30 dark:bg-blue-light-500/10 dark:text-blue-light-400">
          <FiInfo className="mt-0.5 size-4 shrink-0" />
          Only the store owner can change integrations. You can see which ones are connected.
        </div>
      )}

      {/* Integrations: 4 per row on wide screens, ordered by group */}
      <section aria-labelledby="integrations-heading">
        <h3 id="integrations-heading" className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Integrations
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...sections]
            .sort((a, b) => GROUP_ORDER.indexOf(INTEGRATIONS[a.key].group) - GROUP_ORDER.indexOf(INTEGRATIONS[b.key].group))
            .map((section) => {
              const meta = INTEGRATIONS[section.key];
              const connected = meta.connected(data.features);
              return (
                <article key={section.key} aria-label={meta.title} className={`${card} flex flex-col p-5 transition hover:shadow-theme-md`}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      {meta.icon}
                    </span>
                    <StatusPill connected={connected} />
                  </div>
                  <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">{meta.group}</p>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">{meta.title}</h4>
                  <p className="mt-1 flex-1 text-sm text-gray-500 dark:text-gray-400">{meta.description}</p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setOpenKey(section.key)}
                      className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                        connected
                          ? "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                          : "bg-brand-500 text-white hover:bg-brand-600"
                      }`}
                    >
                      {connected ? "Configure" : "Configure & connect"}
                    </button>
                  )}
                </article>
              );
            })}
        </div>
      </section>

      {/* Webhooks */}
      {webhooks && (
        <section className={`${card} p-5`}>
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Webhook URLs</h3>
          <p className="mb-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
            Paste these into the courier and payment provider panels so order statuses update automatically.
            They use your server's public address, so on the live site they show your live API domain.
          </p>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <CopyRow name="Pathao" url={webhooks.pathao} />
            <CopyRow name="Steadfast" url={webhooks.steadfast} />
            <CopyRow name="SSLCommerz IPN" url={webhooks.sslcommerz.ipn} />
          </div>
        </section>
      )}

      {openSection && (
        <IntegrationPanel section={openSection} onClose={closePanel}>
          <IntegrationForm
            key={`${openSection.key}-${version}`}
            schema={openSection}
            values={data.settings[openSection.key] || {}}
            canEdit={canManage}
            onSave={(patch) => save(openSection, patch)}
            onTest={() => test(openSection)}
          />
        </IntegrationPanel>
      )}
    </div>
  );
};

export default StoreSettings;
