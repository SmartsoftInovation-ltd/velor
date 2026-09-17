import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiEye, FiPlus, FiShield, FiUserPlus, FiUsers } from "react-icons/fi";
import PageMeta from "../../components/common/PageMeta";
import { errorMessage } from "../../platform/api";
import { usersApi } from "../../platform/endpoints";
import { usePlatformAuth } from "../../platform/PlatformAuthContext";
import type { PlatformUser } from "../../platform/types";
import {
  Avatar,
  cardClass,
  ConsoleHeader,
  EmptyState,
  Field,
  formatDate,
  inputClass,
  Modal,
  primaryButtonClass,
  RefreshButton,
  secondaryButtonClass,
} from "./ui";

type Role = PlatformUser["role"];
const empty = { name: "", email: "", password: "", role: "support" as Role };

const ROLES: { value: Role; title: string; text: string; icon: React.ReactNode }[] = [
  { value: "support", title: "Support", text: "Read-only: sees sellers, settings status and activity.", icon: <FiEye /> },
  { value: "superadmin", title: "Superadmin", text: "Full control: creates sellers, changes settings and operators.", icon: <FiShield /> },
];

const RoleBadge = ({ role }: { role: Role }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
      role === "superadmin"
        ? "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
        : "bg-gray-100 text-gray-600 ring-gray-500/15 dark:bg-white/5 dark:text-gray-400"
    }`}
  >
    {role === "superadmin" ? <FiShield className="size-3" /> : <FiEye className="size-3" />}
    {role === "superadmin" ? "Superadmin" : "Support"}
  </span>
);

const Switch = ({ checked, disabled, label, onChange }: { checked: boolean; disabled?: boolean; label: string; onChange: (value: boolean) => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-accent-500" : "bg-gray-200 dark:bg-white/10"}`}
  >
    <span className={`inline-block size-5 rounded-full bg-white shadow-theme-xs transition ${checked ? "translate-x-5.5" : "translate-x-0.5"}`} />
  </button>
);

const AddOperatorForm = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const create = useMutation({
    mutationFn: () => usersApi.create({ ...form, email: form.email.trim(), name: form.name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "users"] });
      toast.success("Operator added");
      onClose();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="operator-name" label="Name">
          <input id="operator-name" className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field id="operator-email" label="Email">
          <input id="operator-email" type="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <div className="sm:col-span-2">
          <Field id="operator-password" label="Password" hint="At least 12 characters.">
            <input id="operator-password" type="password" autoComplete="new-password" minLength={12} className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Role</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((role) => {
            const selected = form.role === role.value;
            return (
              <label
                key={role.value}
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
                  selected ? "border-accent-500 bg-accent-25 ring-3 ring-accent-500/10 dark:bg-accent-500/10" : "border-gray-200 hover:border-gray-300 dark:border-gray-800"
                }`}
              >
                <input type="radio" name="operator-role" value={role.value} checked={selected} onChange={() => setForm({ ...form, role: role.value })} className="sr-only" />
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-accent-500 text-white" : "bg-gray-100 text-gray-500 dark:bg-white/5"}`}>{role.icon}</span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white/90">{role.title}</span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{role.text}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {create.isError && (
        <p role="alert" className="rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          {errorMessage(create.error, "Could not add the operator")}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
        <button type="submit" disabled={create.isPending} className={primaryButtonClass}>{create.isPending ? "Adding…" : "Add operator"}</button>
      </div>
    </form>
  );
};

// Platform operators (superadmin only)
const OperatorsPage = () => {
  const { operator: me, isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ["platform", "users"], queryFn: usersApi.list });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof usersApi.update>[1] }) => usersApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "users"] });
      toast.success("Operator updated");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const operators = data ?? [];
  const active = operators.filter((u) => u.isActive).length;
  const superadmins = operators.filter((u) => u.role === "superadmin").length;

  return (
    <>
      <PageMeta title="Operators · Platform Console" description="Platform operator accounts" />
      <ConsoleHeader
        crumbs={[{ label: "Platform Console" }, { label: "Operators" }]}
        title="Operators"
        subtitle={data ? `${operators.length} operators · ${active} active · ${superadmins} superadmin` : "Loading operators…"}
        actions={
          <>
            <RefreshButton onClick={() => refetch()} spinning={isFetching} />
            {isSuperadmin && (
              <button type="button" onClick={() => setAdding(true)} className={primaryButtonClass}>
                <FiPlus className="size-4" />
                Add operator
              </button>
            )}
          </>
        }
      />

      <section className={`${cardClass} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="w-16 px-5 py-3">S/N</th>
                <th className="px-5 py-3">Operator</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3 text-right">Active</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                    <td colSpan={5} className="px-5 py-4"><div className="h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" /></td>
                  </tr>
                ))}
              {operators.map((user, index) => {
                const self = user._id === me?._id;
                const locked = self || !isSuperadmin;
                return (
                  <tr key={user._id} className="border-t border-gray-100 transition hover:bg-accent-25/60 dark:border-gray-800 dark:hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-400">#{index + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-semibold text-gray-900 dark:text-white/90">
                            {user.name}
                            {self && <span className="rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white dark:bg-white dark:text-gray-900">You</span>}
                          </p>
                          <p className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {locked ? (
                        <RoleBadge role={user.role} />
                      ) : (
                        <select
                          aria-label={`Role of ${user.email}`}
                          value={user.role}
                          onChange={(e) => update.mutate({ id: user._id, body: { role: e.target.value as Role } })}
                          className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-medium text-gray-700 focus:border-accent-400 focus:outline-none focus:ring-3 focus:ring-accent-500/15 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                        >
                          <option value="support">Support</option>
                          <option value="superadmin">Superadmin</option>
                        </select>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-gray-600 dark:text-gray-400">{formatDate(user.lastLoginAt, true)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">
                        <Switch
                          checked={user.isActive}
                          disabled={locked}
                          label={`Active ${user.email}`}
                          onChange={(value) => update.mutate({ id: user._id, body: { isActive: value } })}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data && !operators.length && (
          <EmptyState icon={<FiUsers />} title="No operators" text="Add people who help run the platform." />
        )}
      </section>

      {adding && (
        <Modal title="Add operator" description="Operators manage sellers from the Platform Console." icon={<FiUserPlus />} onClose={() => setAdding(false)} width="max-w-xl">
          <AddOperatorForm onClose={() => setAdding(false)} />
        </Modal>
      )}
    </>
  );
};

export default OperatorsPage;
