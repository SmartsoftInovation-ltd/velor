import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tenantsApi } from "../api/endpoints";
import type { TenantStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import CreateTenantForm from "../components/CreateTenantForm";
import StatusBadge from "../components/StatusBadge";

const TenantsPage = () => {
  const { isSuperadmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TenantStatus | "">("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tenants", { search, status, page }],
    queryFn: () => tenantsApi.list({ search, status, page, limit: 20 }),
  });

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Stores</h1>
        <input
          aria-label="Search stores"
          placeholder="Search name or workspace"
          className="ml-auto rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select aria-label="Status" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={status}
          onChange={(e) => { setStatus(e.target.value as TenantStatus | ""); setPage(1); }}>
          <option value="">All statuses</option>
          <option>active</option>
          <option>provisioning</option>
          <option>suspended</option>
          <option>cancelled</option>
        </select>
        {isSuperadmin && (
          <button onClick={() => setCreating((v) => !v)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
            {creating ? "Close" : "New store"}
          </button>
        )}
      </div>

      {creating && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <CreateTenantForm onCreated={() => queryClient.invalidateQueries({ queryKey: ["tenants"] })} />
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Store</th><th className="px-4 py-3">Workspace</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Plan</th><th className="px-4 py-3">Staff limit</th><th className="px-4 py-3">Created</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-6 text-slate-500">Loading…</td></tr>}
            {isError && <tr><td colSpan={6} className="px-4 py-6 text-rose-600">Could not load stores</td></tr>}
            {data?.items.map((tenant) => (
              <tr key={tenant._id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3"><Link to={`/tenants/${tenant._id}`} className="font-medium text-indigo-700 hover:underline">{tenant.name}</Link></td>
                <td className="px-4 py-3 font-mono text-xs">{tenant.slug}</td>
                <td className="px-4 py-3"><StatusBadge status={tenant.status} /></td>
                <td className="px-4 py-3">{tenant.plan}</td>
                <td className="px-4 py-3">{tenant.limits?.maxStaff ?? "∞"}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(tenant.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-slate-500">No stores found</td></tr>}
          </tbody>
        </table>
      </section>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border px-3 py-1 disabled:opacity-40">Previous</button>
          <span>{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-md border px-3 py-1 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
};

export default TenantsPage;
