import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { errorMessage } from "../api/client";
import { usersApi } from "../api/endpoints";
import type { PlatformUser } from "../api/types";
import { useAuth } from "../auth/AuthContext";

const empty = { name: "", email: "", password: "", role: "support" as PlatformUser["role"] };

// Platform operators (superadmin only)
const UsersPage = () => {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const { data } = useQuery({ queryKey: ["platform-users"], queryFn: usersApi.list });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["platform-users"] });
  const onError = (error: unknown) => toast.error(errorMessage(error));

  const create = useMutation({ mutationFn: () => usersApi.create(form), onSuccess: () => { setForm(empty); refresh(); toast.success("Operator added"); }, onError });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof usersApi.update>[1] }) => usersApi.update(id, body),
    onSuccess: refresh,
    onError,
  });

  const input = "rounded-md border border-slate-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Operators</h1>

      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <input aria-label="Name" placeholder="Name" className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input aria-label="Email" placeholder="Email" type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input aria-label="Password" placeholder="Password (12+ chars)" type="password" className={input} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select aria-label="Role" className={input} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as PlatformUser["role"] })}>
          <option value="support">support (read-only)</option>
          <option value="superadmin">superadmin</option>
        </select>
        <button type="submit" className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white">Add operator</button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Active</th><th className="px-4 py-3">Last login</th></tr></thead>
          <tbody>
            {data?.map((u) => {
              const self = u._id === me?._id;
              return (
                <tr key={u._id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">{u.name}{self && " (you)"}</td>
                  <td className="px-4 py-2">{u.email}</td>
                  <td className="px-4 py-2">
                    <select aria-label={`Role of ${u.email}`} disabled={self} className="rounded border px-2 py-1" value={u.role}
                      onChange={(e) => update.mutate({ id: u._id, body: { role: e.target.value as PlatformUser["role"] } })}>
                      <option value="support">support</option>
                      <option value="superadmin">superadmin</option>
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input type="checkbox" aria-label={`Active ${u.email}`} disabled={self} checked={u.isActive}
                      onChange={(e) => update.mutate({ id: u._id, body: { isActive: e.target.checked } })} />
                  </td>
                  <td className="px-4 py-2 text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default UsersPage;
