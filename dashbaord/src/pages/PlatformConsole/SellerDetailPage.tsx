import { useEffect, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  FiActivity,
  FiCheck,
  FiCopy,
  FiDroplet,
  FiGlobe,
  FiGrid,
  FiInfo,
  FiLink,
  FiPause,
  FiPlay,
} from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { settingsApi, tenantsApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import type { Tenant } from "../../platform/types";
import type { Features } from "../../context/AuthContext";
import IntegrationGrid, {
  countConnected,
} from "../Settings/StoreSettings/IntegrationGrid";
import type {
  SectionSchema,
  SectionValues,
} from "../Settings/StoreSettings/types";
import OwnerPasswordCard from "./OwnerPasswordCard";
import SellerBillingCard from "./SellerBillingCard";
import SellerColorTab from "./SellerColorTab";
import SellerDomainsTab from "./SellerDomainsTab";
import SellerStatusBadge from "./SellerStatusBadge";
import SellerStatusDialog, { canSuspend } from "./SellerStatusDialog";
import {
  Avatar,
  cardClass,
  Chip,
  ConsoleHeader,
  Field,
  formatDate,
  inputClass,
  primaryButtonClass,
  RefreshButton,
  secondaryButtonClass,
} from "./ui";

const TABS = [
  { key: "overview", label: "Overview", icon: <FiInfo /> },
  { key: "domains", label: "Domains", icon: <FiGlobe /> },
  { key: "color", label: "Website Color", icon: <FiDroplet /> },
  { key: "integrations", label: "Integrations", icon: <FiGrid /> },
  { key: "webhooks", label: "Webhooks", icon: <FiLink /> },
  { key: "audit", label: "Audit", icon: <FiActivity /> },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const SectionTitle = ({
  title,
  text,
  action,
}: {
  title: string;
  text?: string;
  action?: ReactNode;
}) => (
  <div className="mb-5 flex items-start justify-between gap-3">
    <div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
        {title}
      </h2>
      {text && (
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          {text}
        </p>
      )}
    </div>
    {action}
  </div>
);

const Overview = ({ seller }: { seller: Tenant }) => {
  const { isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const initial = { name: seller.name };
  const [form, setForm] = useState(initial);
  useEffect(() => setForm({ name: seller.name }), [seller]);
  const dirty = form.name !== initial.name;

  const save = useMutation({
    mutationFn: () =>
      tenantsApi.update(seller._id, {
        name: form.name.trim(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["platform", "tenant", seller._id], updated);
      queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
      toast.success("Seller information saved");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const facts: [string, ReactNode][] = [
    [
      "Workspace",
      <code className="font-mono text-gray-800 dark:text-gray-200">
        {seller.slug}
      </code>,
    ],
    ["Status", <SellerStatusBadge status={seller.status} />],
    ...(seller.statusReason
      ? [["Reason", seller.statusReason] as [string, ReactNode]]
      : []),
    ["Owner", seller.owner?.name ?? "—"],
    [
      "Email",
      seller.owner?.email ? (
        <a
          href={`mailto:${seller.owner.email}`}
          className="break-all hover:text-accent-600"
        >
          {seller.owner.email}
        </a>
      ) : (
        "—"
      ),
    ],
    ["Phone", seller.owner?.phone ?? "—"],
    ["Created", formatDate(seller.createdAt, true)],
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <section className={`${cardClass} p-6 lg:col-span-3`}>
        <SectionTitle
          title="Seller information"
          text="The name this seller is shown under."
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="space-y-4"
        >
          <Field id="seller-name" label="Seller name">
            <input
              id="seller-name"
              className={inputClass}
              value={form.name}
              readOnly={!isSuperadmin}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          {isSuperadmin && (
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={!dirty}
                onClick={() => setForm(initial)}
                className={secondaryButtonClass}
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={!dirty || save.isPending}
                className={primaryButtonClass}
              >
                {save.isPending ? "Saving…" : "Save seller info"}
              </button>
            </div>
          )}
        </form>
      </section>

      <section className={`${cardClass} p-6 lg:col-span-2`}>
        <SectionTitle title="At a glance" />
        <dl className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
          {facts.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
              <dd className="text-right font-medium text-gray-800 dark:text-gray-200">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <SellerBillingCard seller={seller} canEdit={isSuperadmin} />

      {isSuperadmin && seller.ownerUserId && <OwnerPasswordCard tenantId={seller._id} />}
    </div>
  );
};

const InvoicePrefix = ({
  tenantId,
  value,
  canEdit,
  onSaved,
}: {
  tenantId: string;
  value: string;
  canEdit: boolean;
  onSaved: () => void;
}) => {
  const [prefix, setPrefix] = useState(value);
  useEffect(() => setPrefix(value), [value]);
  const save = useMutation({
    mutationFn: () =>
      settingsApi.update(tenantId, "general", {
        invoicePrefix: prefix.trim().toUpperCase(),
      }),
    onSuccess: () => {
      toast.success("Invoice prefix saved");
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-44">
        <Field id="invoice-prefix" label="Invoice prefix">
          <input
            id="invoice-prefix"
            className={`${inputClass} font-mono uppercase`}
            value={prefix}
            readOnly={!canEdit}
            onChange={(e) => setPrefix(e.target.value)}
          />
        </Field>
      </div>
      {canEdit && (
        <button
          type="button"
          disabled={prefix.trim().toUpperCase() === value}
          onClick={() => save.mutate()}
          className={`${primaryButtonClass} h-11`}
        >
          Save prefix
        </button>
      )}
      <p className="basis-full text-xs text-gray-500 dark:text-gray-400">
        2–8 letters or digits. Applies to new invoices, returns and serials
        only.
      </p>
    </div>
  );
};

const IntegrationsTab = ({ tenantId }: { tenantId: string }) => {
  const { isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const schema = useQuery({
    queryKey: ["platform", "settings-schema"],
    queryFn: settingsApi.schema,
    staleTime: Infinity,
  });
  const current = useQuery({
    queryKey: ["platform", "settings", tenantId],
    queryFn: () => settingsApi.get(tenantId),
  });
  const reload = () =>
    queryClient.invalidateQueries({
      queryKey: ["platform", "settings", tenantId],
    });

  if (schema.isLoading || current.isLoading) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-busy="true"
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={`${cardClass} h-40 animate-pulse`} />
        ))}
      </div>
    );
  }
  if (!schema.data || !current.data)
    return <p className="text-sm text-error-600">Could not load settings</p>;

  const sections = schema.data as unknown as SectionSchema[];
  const values = current.data.settings as Record<string, SectionValues>;
  const features = current.data.features as unknown as Features;
  const total = sections.filter((s) => s.key !== "general").length;
  const connected = countConnected(sections, features);

  return (
    <div className="space-y-5">
      <section
        className={`${cardClass} flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between`}
      >
        <InvoicePrefix
          tenantId={tenantId}
          value={String(values.general?.invoicePrefix ?? "")}
          canEdit={isSuperadmin}
          onSaved={reload}
        />
        <div className="min-w-[14rem]">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
            Integrations
          </p>
          <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white/90">
            {connected} of {total} integrations connected
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
            <div
              className="h-full rounded-full bg-accent-500 transition-all"
              style={{ width: `${total ? (connected / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </section>
      <IntegrationGrid
        schema={sections}
        settings={values}
        features={features}
        canManage={isSuperadmin}
        onSave={async (section, patch) => {
          const result = await settingsApi.update(
            tenantId,
            section.path,
            patch,
          );
          toast.success(
            result.changes.length ? "Settings saved" : "Nothing changed",
          );
          await reload();
        }}
        onTest={(section) => settingsApi.test(tenantId, section.path)}
      />
    </div>
  );
};

const CopyUrl = ({ name, url }: { name: string; url: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — select the URL and copy it manually");
    }
  };
  return (
    <div className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-40 shrink-0 text-sm font-medium text-gray-700 dark:text-gray-300">
        {name}
      </span>
      <code
        className="min-w-0 flex-1 truncate rounded-xl bg-gray-50 px-3.5 py-2.5 font-mono text-xs text-gray-600 dark:bg-white/[0.03] dark:text-gray-400"
        title={url}
      >
        {url}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${name} URL`}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 transition hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400"
      >
        {copied ? (
          <FiCheck className="size-4" />
        ) : (
          <FiCopy className="size-4" />
        )}
      </button>
    </div>
  );
};

const WebhooksTab = ({ tenantId }: { tenantId: string }) => {
  const { data } = useQuery({
    queryKey: ["platform", "webhooks", tenantId],
    queryFn: () => settingsApi.webhooks(tenantId),
  });
  if (!data) return <div className={`${cardClass} h-48 animate-pulse`} />;
  const rows: [string, string][] = [
    ["Pathao", data.pathao],
    ["Steadfast", data.steadfast],
    ...Object.entries(data.sslcommerz).map(([name, url]): [string, string] => [
      `SSLCommerz ${name}`,
      url,
    ]),
  ];
  return (
    <section className={`${cardClass} p-6`}>
      <SectionTitle
        title="Webhook URLs"
        text="Paste these into the courier and payment provider panels for this seller."
      />
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map(([name, url]) => (
          <CopyUrl key={name} name={name} url={url} />
        ))}
      </div>
    </section>
  );
};

const AuditTab = ({ tenantId }: { tenantId: string }) => {
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["platform", "audit", tenantId, page],
    queryFn: () => tenantsApi.audit(tenantId, page),
  });
  if (!data) return <div className={`${cardClass} h-48 animate-pulse`} />;
  return (
    <section className={`${cardClass} p-6`}>
      <SectionTitle
        title="Activity"
        text="Every platform change to this seller, newest first."
      />
      {!data.items.length && (
        <p className="py-6 text-center text-sm text-gray-500">
          No activity yet
        </p>
      )}
      <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-gray-200 dark:before:bg-gray-800">
        {data.items.map((entry) => (
          <li key={entry._id} className="relative pl-7">
            <span className="absolute left-0 top-1 size-[15px] rounded-full border-[3px] border-white bg-accent-500 dark:border-gray-900" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                {entry.action}
              </span>
              <span className="text-xs text-gray-400">
                {formatDate(entry.createdAt, true)}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              by {entry.actorEmail}
            </p>
            {entry.changes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entry.changes.map((change) => (
                  <Chip key={change} tone="gray">
                    <span className="font-mono">{change}</span>
                  </Chip>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {data.total > data.limit && (
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className={secondaryButtonClass}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page * data.limit >= data.total}
            onClick={() => setPage((p) => p + 1)}
            className={secondaryButtonClass}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
};

const SellerDetailPage = () => {
  const { tenantId = "" } = useParams();
  const { isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab: TabKey = TABS.some((t) => t.key === requested)
    ? (requested as TabKey)
    : "overview";
  const [changingStatus, setChangingStatus] = useState(false);
  const {
    data: seller,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["platform", "tenant", tenantId],
    queryFn: () => tenantsApi.get(tenantId),
  });

  if (isLoading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className={`${cardClass} h-32 animate-pulse`} />
        <div className={`${cardClass} h-64 animate-pulse`} />
      </div>
    );
  }
  if (isError || !seller)
    return <p className="text-sm text-error-600">Seller not found</p>;

  const onStatusChanged = (updated: Tenant) => {
    queryClient.setQueryData(["platform", "tenant", seller._id], updated);
    queryClient.invalidateQueries({ queryKey: ["platform", "tenants"] });
  };

  return (
    <>
      <ConsoleHeader
        crumbs={[
          { label: "Platform Console" },
          { label: "Sellers", to: "/platform/sellers" },
          { label: seller.name },
        ]}
        title="Seller Details"
        subtitle="Information, domains, integrations, webhooks and activity for one seller."
        actions={
          <RefreshButton onClick={() => refetch()} spinning={isFetching} />
        }
      />

      <section className={`${cardClass} mb-5 overflow-hidden`}>
        <div className="relative flex flex-col gap-5 overflow-hidden border-b border-gray-100 bg-gradient-to-r from-accent-50 via-accent-25 to-white px-6 py-6 md:flex-row md:items-center md:justify-between dark:border-gray-800 dark:from-accent-500/10 dark:via-accent-500/5 dark:to-transparent">
          <div className="pointer-events-none absolute -left-10 -top-16 size-48 rounded-full bg-accent-500/10 blur-3xl" />
          <div className="relative flex min-w-0 items-center gap-4">
            <Avatar name={seller.name} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="truncate text-xl font-semibold text-gray-900 dark:text-white/90">
                  {seller.name}
                </h2>
                <SellerStatusBadge status={seller.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <code className="font-mono">{seller.slug}</code>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <Chip>{seller.plan}</Chip>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span>Since {formatDate(seller.createdAt)}</span>
              </div>
            </div>
          </div>
          {isSuperadmin &&
            seller.status !== "cancelled" &&
            (canSuspend(seller) ? (
              <button
                type="button"
                onClick={() => setChangingStatus(true)}
                className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 text-sm font-semibold text-error-600 transition hover:bg-error-100 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400"
              >
                <FiPause className="size-4" />
                Suspend seller
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setChangingStatus(true)}
                className={`relative ${primaryButtonClass}`}
              >
                <FiPlay className="size-4" />
                Activate seller
              </button>
            ))}
        </div>

        <div className="px-6 py-4">
          <div
            role="tablist"
            className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 dark:bg-white/5"
          >
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() =>
                  setSearchParams(
                    item.key === "overview" ? {} : { tab: item.key },
                    { replace: true },
                  )
                }
                className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
                  tab === item.key
                    ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white"
                    : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <span className={tab === item.key ? "text-accent-600" : ""}>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {tab === "overview" && <Overview seller={seller} />}
      {tab === "domains" && <SellerDomainsTab tenantId={seller._id} />}
      {tab === "color" && <SellerColorTab tenantId={seller._id} />}
      {tab === "integrations" && <IntegrationsTab tenantId={seller._id} />}
      {tab === "webhooks" && <WebhooksTab tenantId={seller._id} />}
      {tab === "audit" && <AuditTab tenantId={seller._id} />}

      {changingStatus && (
        <SellerStatusDialog
          seller={seller}
          onClose={() => setChangingStatus(false)}
          onDone={onStatusChanged}
        />
      )}
    </>
  );
};

export default SellerDetailPage;
