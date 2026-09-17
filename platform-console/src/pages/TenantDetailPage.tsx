import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { errorMessage } from "../api/client";
import { settingsApi, tenantsApi } from "../api/endpoints";
import type { SectionValues, Tenant } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import SettingsSectionForm from "../components/SettingsSectionForm";
import StatusBadge from "../components/StatusBadge";

const TABS = ["Overview", "Settings", "Webhooks", "Audit"] as const;
type Tab = (typeof TABS)[number];

const card = "rounded-xl border border-slate-200 bg-white p-5";

const Overview = ({ tenant }: { tenant: Tenant }) => {
  const { isSuperadmin } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [maxStaff, setMaxStaff] = useState(tenant.limits?.maxStaff?.toString() ?? "");

  const refresh = (updated: Tenant) => queryClient.setQueryData(["tenant", tenant._id], updated);
  const onError = (error: unknown) => toast.error(errorMessage(error));

  const suspend = useMutation({ mutationFn: () => tenantsApi.suspend(tenant._id, reason), onSuccess: refresh, onError });
  const activate = useMutation({ mutationFn: () => tenantsApi.activate(tenant._id), onSuccess: refresh, onError });
  const saveLimits = useMutation({
    mutationFn: () => tenantsApi.update(tenant._id, { limits: { maxStaff: maxStaff === "" ? null : Number(maxStaff) } }),
    onSuccess: (updated) => { refresh(updated); toast.success("Limits saved"); },
    onError,
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className={card}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Workspace</dt><dd className="font-mono">{tenant.slug}</dd>
          <dt className="text-slate-500">Status</dt><dd><StatusBadge status={tenant.status} /> {tenant.statusReason}</dd>
          <dt className="text-slate-500">Plan</dt><dd>{tenant.plan}</dd>
          <dt className="text-slate-500">Created</dt><dd>{new Date(tenant.createdAt).toLocaleString()}</dd>
        </dl>
      </section>

      {isSuperadmin && (
        <section className={`${card} space-y-4`}>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="max-staff" className="mb-1 block text-xs text-slate-600">Max staff (blank = unlimited)</label>
              <input id="max-staff" type="number" min={0} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={maxStaff} onChange={(e) => setMaxStaff(e.target.value)} />
            </div>
            <button onClick={() => saveLimits.mutate()} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Save limits</button>
          </div>

          {tenant.status === "active" || tenant.status === "provisioning" ? (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="suspend-reason" className="mb-1 block text-xs text-slate-600">Suspension reason</label>
                <input id="suspend-reason" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <button onClick={() => suspend.mutate()} className="rounded-md bg-amber-600 px-3 py-2 text-sm text-white">Suspend</button>
            </div>
          ) : null}
          {(tenant.status === "suspended" || tenant.status === "provisioning") && (
            <button onClick={() => activate.mutate()} className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">Activate</button>
          )}
        </section>
      )}
    </div>
  );
};

const SettingsTab = ({ tenantId }: { tenantId: string }) => {
  const { isSuperadmin } = useAuth();
  const queryClient = useQueryClient();
  const schema = useQuery({ queryKey: ["settings-schema"], queryFn: settingsApi.schema, staleTime: Infinity });
  const current = useQuery({ queryKey: ["settings", tenantId], queryFn: () => settingsApi.get(tenantId) });

  if (schema.isLoading || current.isLoading) return <p className="text-sm text-slate-500">Loading settings…</p>;
  if (!schema.data || !current.data) return <p className="text-sm text-rose-600">Could not load settings</p>;

  return (
    <div className="space-y-4">
      {schema.data.map((section) => (
        <section key={section.key} aria-label={section.key} className={card}>
          <h3 className="mb-3 font-medium">{section.key} <span className="font-mono text-xs text-slate-400">/{section.path}</span></h3>
          <SettingsSectionForm
            key={`${section.key}-${current.data.version}`}
            schema={section}
            values={(current.data.settings[section.key] || {}) as SectionValues}
            canEdit={isSuperadmin}
            onSave={async (patch) => {
              try {
                const result = await settingsApi.update(tenantId, section.path, patch);
                toast.success(result.changes.length ? `Saved: ${result.changes.join(", ")}` : "No changes");
                await queryClient.invalidateQueries({ queryKey: ["settings", tenantId] });
              } catch (error) {
                toast.error(errorMessage(error, "Could not save"));
              }
            }}
            onTest={section.testable ? () => settingsApi.test(tenantId, section.path) : undefined}
          />
        </section>
      ))}
    </div>
  );
};

const WebhooksTab = ({ tenantId }: { tenantId: string }) => {
  const { data } = useQuery({ queryKey: ["webhooks", tenantId], queryFn: () => settingsApi.webhooks(tenantId) });
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  const rows: [string, string][] = [
    ["Pathao", data.pathao],
    ["Steadfast", data.steadfast],
    ...Object.entries(data.sslcommerz).map(([name, url]): [string, string] => [`SSLCommerz ${name}`, url]),
  ];
  return (
    <section className={card}>
      <dl className="space-y-3 text-sm">
        {rows.map(([name, url]) => (
          <div key={name}><dt className="font-medium">{name}</dt><dd className="break-all font-mono text-xs text-slate-600">{url}</dd></div>
        ))}
      </dl>
    </section>
  );
};

const AuditTab = ({ tenantId }: { tenantId: string }) => {
  const [page, setPage] = useState(1);
  const { data } = useQuery({ queryKey: ["audit", tenantId, page], queryFn: () => tenantsApi.audit(tenantId, page) });
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>;
  return (
    <section className={card}>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">When</th><th>Action</th><th>By</th><th>Fields</th></tr></thead>
        <tbody>
          {data.items.map((entry) => (
            <tr key={entry._id} className="border-t border-slate-100 align-top">
              <td className="py-2 pr-3 text-slate-500">{new Date(entry.createdAt).toLocaleString()}</td>
              <td className="pr-3 font-mono text-xs">{entry.action}</td>
              <td className="pr-3">{entry.actorEmail}</td>
              <td className="font-mono text-xs">{entry.changes.map((c) => <div key={c}>{c}</div>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.total > data.limit && (
        <div className="mt-3 flex justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-2 disabled:opacity-40">Previous</button>
          <button disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)} className="rounded border px-2 disabled:opacity-40">Next</button>
        </div>
      )}
    </section>
  );
};

const TenantDetailPage = () => {
  const { tenantId = "" } = useParams();
  const [tab, setTab] = useState<Tab>("Overview");
  const { data: tenant, isLoading, isError } = useQuery({ queryKey: ["tenant", tenantId], queryFn: () => tenantsApi.get(tenantId) });

  if (isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (isError || !tenant) return <p className="text-sm text-rose-600">Store not found</p>;

  return (
    <div className="space-y-5">
      <Link to="/" className="text-sm text-indigo-700">← Stores</Link>
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">{tenant.name}</h1>
        <StatusBadge status={tenant.status} />
      </div>
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {TABS.map((name) => (
          <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)}
            className={`px-4 py-2 text-sm ${tab === name ? "border-b-2 border-indigo-600 font-medium text-indigo-700" : "text-slate-500"}`}>
            {name}
          </button>
        ))}
      </div>
      {tab === "Overview" && <Overview tenant={tenant} />}
      {tab === "Settings" && <SettingsTab tenantId={tenant._id} />}
      {tab === "Webhooks" && <WebhooksTab tenantId={tenant._id} />}
      {tab === "Audit" && <AuditTab tenantId={tenant._id} />}
    </div>
  );
};

export default TenantDetailPage;
