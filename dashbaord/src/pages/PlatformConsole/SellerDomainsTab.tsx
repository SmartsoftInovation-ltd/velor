import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiCheck, FiCopy, FiGlobe, FiPlus, FiRefreshCw, FiStar, FiTrash2 } from "react-icons/fi";
import { errorMessage } from "../../platform/api";
import { domainsApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import type { DomainStatus, TenantDomain } from "../../platform/types";
import { cardClass, Chip, EmptyState, Field, formatDate, inputClass, Modal, primaryButtonClass, secondaryButtonClass } from "./ui";

// Storefront hostnames for one seller. A domain only serves shoppers once the
// DNS check passes, so every non-active row shows the TXT record to publish.

const STATUS: Record<DomainStatus, { label: string; pill: string; dot: string }> = {
  active: { label: "Active", pill: "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400", dot: "bg-accent-500 animate-pulse" },
  pending: { label: "Awaiting DNS", pill: "bg-warning-50 text-warning-700 ring-warning-500/20 dark:bg-warning-500/15 dark:text-warning-400", dot: "bg-warning-500" },
  verifying: { label: "Verifying", pill: "bg-blue-light-50 text-blue-light-700 ring-blue-light-500/20 dark:bg-blue-light-500/15 dark:text-blue-light-400", dot: "bg-blue-light-500" },
  failed: { label: "Failed", pill: "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400", dot: "bg-error-500" },
};

const DomainStatusPill = ({ status }: { status: DomainStatus }) => {
  const style = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.pill}`}>
      <span className={`size-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  );
};

const CopyValue = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy — select the value and copy it manually");
    }
  };
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wider text-gray-400">{label}</span>
      <code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label}`}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 transition hover:bg-accent-100 dark:bg-accent-500/15 dark:text-accent-400"
      >
        {copied ? <FiCheck className="size-4" /> : <FiCopy className="size-4" />}
      </button>
    </div>
  );
};

// Second-level labels that are part of a country suffix (example.com.bd, example.co.uk)
const COUNTRY_SECOND_LEVELS = new Set(["com", "net", "org", "edu", "gov", "ac", "co", "info", "mil"]);

// The zone the seller manages in their DNS panel: the last two labels, or three
// under a country suffix like .com.bd
const rootDomain = (host: string) => {
  const labels = host.split(".");
  const [secondLevel, tld] = labels.slice(-2);
  const countrySuffix = labels.length > 2 && tld.length === 2 && COUNTRY_SECOND_LEVELS.has(secondLevel);
  return labels.slice(countrySuffix ? -3 : -2).join(".");
};

// DNS panels append the root domain to the name themselves, so the seller types
// only what comes before it: "_ecompos-verify.uat.website" for
// uat.website.example.com, "_ecompos-verify" for example.com
const panelName = (record: TenantDomain["dnsRecord"], root: string) =>
  record.name.endsWith(`.${root}`) ? record.name.slice(0, -(root.length + 1)) : record.name;

const DnsRecord = ({ record, host }: { record: TenantDomain["dnsRecord"]; host: string }) => {
  const root = rootDomain(host);
  return (
    <div className="mt-4 space-y-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Add this as a new record in the DNS panel of <span className="font-mono font-semibold">{root}</span>, then run the check.
      </p>
      <CopyValue label="Type" value={record.type} />
      <CopyValue label="Name" value={panelName(record, root)} />
      <CopyValue label="Value" value={record.value} />
      <p className="text-xs text-gray-500 dark:text-gray-400">
        The panel adds <span className="font-mono">.{root}</span> to the name itself. If yours asks for the full name, use{" "}
        <span className="break-all font-mono">{record.name}</span>.
      </p>
    </div>
  );
};

const AddDomainDialog = ({ tenantId, first, onClose, onAdded }: {
  tenantId: string;
  first: boolean;
  onClose: () => void;
  onAdded: () => void;
}) => {
  const [host, setHost] = useState("");
  const add = useMutation({
    // The first domain becomes the canonical one; later ones are promoted after verifying
    mutationFn: () => domainsApi.add(tenantId, { host: host.trim(), isPrimary: first }),
    onSuccess: (domain) => {
      toast.success(`${domain.host} added — publish the DNS record to verify it`);
      onAdded();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Modal
      title="Add domain"
      icon={<FiGlobe />}
      description="The domain starts as pending and serves no traffic until its DNS record is verified."
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
        className="space-y-5"
      >
        <Field id="domain-host" label="Hostname" hint="No https:// or path, e.g. shop.example.com">
          <input
            id="domain-host"
            className={`${inputClass} font-mono`}
            placeholder="shop.example.com"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            autoFocus
            required
          />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
          <button type="submit" disabled={!host.trim() || add.isPending} className={primaryButtonClass}>
            {add.isPending ? "Adding…" : "Add domain"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const RemoveDomainDialog = ({ tenantId, domain, onClose, onRemoved }: {
  tenantId: string;
  domain: TenantDomain;
  onClose: () => void;
  onRemoved: () => void;
}) => {
  const remove = useMutation({
    mutationFn: () => domainsApi.remove(tenantId, domain._id),
    onSuccess: () => {
      toast.success(`${domain.host} removed`);
      onRemoved();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Modal
      title={`Remove ${domain.host}`}
      icon={<FiAlertTriangle className="text-warning-600" />}
      description={
        domain.status === "active"
          ? "Shoppers on this domain stop reaching the store right away."
          : "The domain is not serving traffic yet, so nothing changes for shoppers."
      }
      onClose={onClose}
    >
      {domain.isPrimary && domain.status === "active" && (
        <p className="mb-5 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-2.5 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
          This is the primary domain. Payment redirects fall back to another active domain, or to the storefront URL in
          settings. Make another domain primary first if you can.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
          className="inline-flex h-10 items-center rounded-xl bg-error-500 px-4 text-sm font-semibold text-white transition hover:bg-error-600 disabled:opacity-60"
        >
          {remove.isPending ? "Removing…" : "Remove domain"}
        </button>
      </div>
    </Modal>
  );
};

const DomainRow = ({ tenantId, domain, canEdit, onChanged, onRemove }: {
  tenantId: string;
  domain: TenantDomain;
  canEdit: boolean;
  onChanged: () => void;
  onRemove: () => void;
}) => {
  const verify = useMutation({
    mutationFn: () => domainsApi.verify(tenantId, domain._id),
    onSuccess: (result) => {
      if (result.status === "active") toast.success(`${result.host} verified`);
      else toast.error(result.failureReason || "Verification failed");
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const primary = useMutation({
    mutationFn: () => domainsApi.makePrimary(tenantId, domain._id),
    onSuccess: (result) => {
      toast.success(`${result.host} is now the primary domain`);
      onChanged();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const active = domain.status === "active";

  return (
    <li aria-label={domain.host} className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {active ? (
              <a
                href={`https://${domain.host}`}
                target="_blank"
                rel="noreferrer"
                className="break-all font-mono text-sm font-semibold text-gray-900 hover:text-accent-600 dark:text-white/90"
              >
                {domain.host}
              </a>
            ) : (
              <span className="break-all font-mono text-sm font-semibold text-gray-900 dark:text-white/90">{domain.host}</span>
            )}
            {domain.isPrimary && (
              <Chip>
                <FiStar className="size-3" />
                Primary
              </Chip>
            )}
            <DomainStatusPill status={domain.status} />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Added {formatDate(domain.createdAt)}
            {domain.verifiedAt && ` · Verified ${formatDate(domain.verifiedAt, true)}`}
            {domain.lastCheckedAt && !active && ` · Last checked ${formatDate(domain.lastCheckedAt, true)}`}
          </p>
          {domain.status === "failed" && domain.failureReason && (
            <p className="mt-1.5 text-sm text-error-600 dark:text-error-400">{domain.failureReason}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex shrink-0 flex-wrap gap-2">
            {!active && (
              <button type="button" disabled={verify.isPending} onClick={() => verify.mutate()} className={primaryButtonClass}>
                <FiRefreshCw className={`size-4 ${verify.isPending ? "animate-spin" : ""}`} />
                {verify.isPending ? "Checking…" : "Verify DNS"}
              </button>
            )}
            {active && !domain.isPrimary && (
              <button type="button" disabled={primary.isPending} onClick={() => primary.mutate()} className={secondaryButtonClass}>
                <FiStar className="size-4" />
                Make primary
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${domain.host}`}
              title="Remove"
              className="inline-flex size-10 items-center justify-center rounded-xl bg-error-50 text-error-600 transition hover:bg-error-100 dark:bg-error-500/15 dark:text-error-400 dark:hover:bg-error-500/25"
            >
              <FiTrash2 className="size-4" />
            </button>
          </div>
        )}
      </div>
      {!active && <DnsRecord record={domain.dnsRecord} host={domain.host} />}
    </li>
  );
};

const SellerDomainsTab = ({ tenantId }: { tenantId: string }) => {
  const { isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TenantDomain | null>(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["platform", "domains", tenantId],
    queryFn: () => domainsApi.list(tenantId),
  });
  // Every domain change is audited, and verify/primary can reorder the list
  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ["platform", "domains", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["platform", "audit", tenantId] });
  };

  if (isLoading) return <div className={`${cardClass} h-48 animate-pulse`} />;
  if (isError || !data) return <p className="text-sm text-error-600">Could not load domains</p>;

  const addButton = isSuperadmin && (
    <button type="button" onClick={() => setAdding(true)} className={primaryButtonClass}>
      <FiPlus className="size-4" />
      Add domain
    </button>
  );

  return (
    <section className={`${cardClass} p-6`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">Domains</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Hostnames that open this seller's storefront. The primary one is used for payment redirects and email links.
          </p>
        </div>
        {data.length > 0 && addButton}
      </div>

      {data.length ? (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.map((domain) => (
            <DomainRow
              key={domain._id}
              tenantId={tenantId}
              domain={domain}
              canEdit={isSuperadmin}
              onChanged={reload}
              onRemove={() => setRemoving(domain)}
            />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<FiGlobe />}
          title="No domains yet"
          text="Add the seller's own domain so shoppers can reach the storefront there."
          action={addButton || undefined}
        />
      )}

      {adding && (
        <AddDomainDialog tenantId={tenantId} first={data.length === 0} onClose={() => setAdding(false)} onAdded={reload} />
      )}
      {removing && (
        <RemoveDomainDialog tenantId={tenantId} domain={removing} onClose={() => setRemoving(null)} onRemoved={reload} />
      )}
    </section>
  );
};

export default SellerDomainsTab;
