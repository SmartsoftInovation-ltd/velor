import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { errorMessage } from "../api/client";
import { permissionsApi } from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";

// Module permission catalog shared by every store's roles
const PermissionsPage = () => {
  const { isSuperadmin } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["permissions"], queryFn: permissionsApi.list });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["permissions"] });
  const onError = (error: unknown) => toast.error(errorMessage(error));

  const create = useMutation({ mutationFn: () => permissionsApi.create(name.trim()), onSuccess: () => { setName(""); refresh(); }, onError });
  const toggle = useMutation({ mutationFn: (p: { id: string; isActive: boolean }) => permissionsApi.update(p.id, { isActive: p.isActive }), onSuccess: refresh, onError });
  const remove = useMutation({ mutationFn: permissionsApi.remove, onSuccess: refresh, onError });

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Permission catalog</h1>
      <p className="text-sm text-slate-500">Modules stores can grant to their roles. Slugs must match the dashboard's permission config.</p>

      {isSuperadmin && (
        <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(); }} className="flex gap-2">
          <input aria-label="Permission name" placeholder="e.g. Store Settings" className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white">Add</button>
        </form>
      )}

      <section className="rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Slug</th><th className="px-4 py-3">Active</th><th /></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={4} className="px-4 py-4 text-slate-500">Loading…</td></tr>}
            {data?.map((p) => (
              <tr key={p._id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">{p.permissionName}</td>
                <td className="px-4 py-2 font-mono text-xs">{p.slug}</td>
                <td className="px-4 py-2">
                  <input type="checkbox" aria-label={`Active ${p.slug}`} checked={p.isActive} disabled={!isSuperadmin}
                    onChange={(e) => toggle.mutate({ id: p._id, isActive: e.target.checked })} />
                </td>
                <td className="px-4 py-2 text-right">
                  {isSuperadmin && (
                    <button className="text-xs text-rose-600" onClick={() => { if (window.confirm(`Delete permission "${p.slug}"? Roles lose it in every store.`)) remove.mutate(p._id); }}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default PermissionsPage;
