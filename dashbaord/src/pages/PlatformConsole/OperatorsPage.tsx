import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { FiEdit2, FiEye, FiPhone, FiPlus, FiPower, FiShield, FiTrash2, FiUserPlus, FiUsers } from "react-icons/fi";
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
  IconAction,
  inputClass,
  Modal,
  primaryButtonClass,
  RefreshButton,
  secondaryButtonClass,
} from "./ui";

type Role = PlatformUser["role"];
const empty = { name: "", email: "", phone: "", password: "", role: "support" as Role };

// Same rule as the API: a Bangladeshi mobile, with or without +88
const PHONE_PATTERN = "(\\+?88)?01[3-9][0-9]{8}";
const PHONE_HINT = "The sign-in code is texted to this number.";
const MIN_PASSWORD = 12;

const ROLES: { value: Role; title: string; text: string; icon: React.ReactNode }[] = [
  { value: "support", title: "Support", text: "Read-only: sees sellers, settings status and activity.", icon: <FiEye /> },
  { value: "superadmin", title: "Superadmin", text: "Full control: creates sellers, changes settings and operators.", icon: <FiShield /> },
];

const errorBoxClass =
  "rounded-xl border border-error-200 bg-error-50 px-3.5 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400";
const dangerButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-error-500 px-4 text-sm font-semibold text-white transition hover:bg-error-600 focus:outline-none focus-visible:ring-3 focus-visible:ring-error-500/30 disabled:cursor-not-allowed disabled:opacity-60";

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

const StatusPill = ({ isActive }: { isActive: boolean }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
      isActive
        ? "bg-accent-50 text-accent-700 ring-accent-500/20 dark:bg-accent-500/15 dark:text-accent-400"
        : "bg-error-50 text-error-700 ring-error-500/20 dark:bg-error-500/15 dark:text-error-400"
    }`}
  >
    <span className={`size-1.5 rounded-full ${isActive ? "animate-pulse bg-accent-500" : "bg-error-500"}`} />
    {isActive ? "Active" : "Inactive"}
  </span>
);

const PhoneText = ({ phone }: { phone?: string | null }) =>
  phone ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs text-gray-700 dark:text-gray-300">
      <FiPhone className="size-3 text-gray-400" />
      {phone}
    </span>
  ) : (
    <span
      title="No phone yet: the sign-in code goes to the platform's default number"
      className="whitespace-nowrap rounded-full bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-700 ring-1 ring-inset ring-warning-500/20 dark:bg-warning-500/15 dark:text-warning-400"
    >
      Not set
    </span>
  );

const PhoneInput = ({ id, value, onChange, autoFocus }: { id: string; value: string; onChange: (value: string) => void; autoFocus?: boolean }) => (
  <input
    id={id}
    type="tel"
    inputMode="tel"
    placeholder="01XXXXXXXXX"
    pattern={PHONE_PATTERN}
    title="A Bangladeshi mobile number, 01XXXXXXXXX"
    className={inputClass}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    required
    autoFocus={autoFocus}
  />
);

const RolePicker = ({ name, value, onChange }: { name: string; value: Role; onChange: (role: Role) => void }) => (
  <fieldset>
    <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Role</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      {ROLES.map((role) => {
        const selected = value === role.value;
        return (
          <label
            key={role.value}
            className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
              selected ? "border-accent-500 bg-accent-25 ring-3 ring-accent-500/10 dark:bg-accent-500/10" : "border-gray-200 hover:border-gray-300 dark:border-gray-800"
            }`}
          >
            <input type="radio" name={name} value={role.value} checked={selected} onChange={() => onChange(role.value)} className="sr-only" />
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
);

const AddOperatorForm = ({ onClose }: { onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(empty);
  const create = useMutation({
    mutationFn: () => usersApi.create({ ...form, email: form.email.trim(), name: form.name.trim(), phone: form.phone.trim() }),
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
        <Field id="operator-phone" label="Phone" hint={PHONE_HINT}>
          <PhoneInput id="operator-phone" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} />
        </Field>
        <Field id="operator-password" label="Password" hint={`At least ${MIN_PASSWORD} characters.`}>
          <input id="operator-password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} className={inputClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
      </div>

      <RolePicker name="operator-role" value={form.role} onChange={(role) => setForm({ ...form, role })} />

      {create.isError && <p role="alert" className={errorBoxClass}>{errorMessage(create.error, "Could not add the operator")}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
        <button type="submit" disabled={create.isPending} className={primaryButtonClass}>{create.isPending ? "Adding…" : "Add operator"}</button>
      </div>
    </form>
  );
};

// A superadmin editing another operator. Your own account is on your profile,
// behind your password, so this form never opens for yourself.
const EditOperatorForm = ({ operator, onClose }: { operator: PlatformUser; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(operator.name);
  const [phone, setPhone] = useState(operator.phone ?? "");
  const [role, setRole] = useState<Role>(operator.role);
  const [password, setPassword] = useState("");

  // Only what changed is sent: a password reset signs the operator out everywhere
  const body = {
    ...(name.trim() !== operator.name && { name: name.trim() }),
    ...(phone.trim() !== (operator.phone ?? "") && { phone: phone.trim() }),
    ...(role !== operator.role && { role }),
    ...(password && { password }),
  };

  const save = useMutation({
    mutationFn: () => usersApi.update(operator._id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "users"] });
      toast.success("Operator updated");
      onClose();
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!Object.keys(body).length) return onClose();
        save.mutate();
      }}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="edit-operator-name" label="Name">
          <input id="edit-operator-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field id="edit-operator-phone" label="Phone" hint={PHONE_HINT}>
          <PhoneInput id="edit-operator-phone" value={phone} onChange={setPhone} />
        </Field>
        <div className="sm:col-span-2">
          <Field id="edit-operator-password" label="New password" hint={`Optional. At least ${MIN_PASSWORD} characters; signs the operator out of every device.`}>
            <input id="edit-operator-password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD} className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
      </div>

      <RolePicker name="edit-operator-role" value={role} onChange={setRole} />

      {save.isError && <p role="alert" className={errorBoxClass}>{errorMessage(save.error, "Could not update the operator")}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryButtonClass}>Cancel</button>
        <button type="submit" disabled={save.isPending} className={primaryButtonClass}>{save.isPending ? "Saving…" : "Save changes"}</button>
      </div>
    </form>
  );
};

const OperatorDetails = ({ operator }: { operator: PlatformUser }) => (
  <div className="space-y-5">
    <div className="flex items-center gap-3.5">
      <Avatar name={operator.name} size="lg" />
      <div className="min-w-0">
        <p className="truncate font-semibold text-gray-900 dark:text-white/90">{operator.name}</p>
        <p className="truncate font-mono text-xs text-gray-500 dark:text-gray-400">{operator.email}</p>
      </div>
    </div>
    <dl className="space-y-3 border-t border-gray-100 pt-5 text-sm dark:border-gray-800">
      {[
        ["Phone", <PhoneText phone={operator.phone} />],
        ["Role", <RoleBadge role={operator.role} />],
        ["Status", <StatusPill isActive={operator.isActive} />],
        ["Last sign-in", formatDate(operator.lastLoginAt, true) || "Never"],
        ["Added", formatDate(operator.createdAt) || "—"],
      ].map(([label, value]) => (
        <div key={label as string} className="flex items-center justify-between gap-3">
          <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
          <dd className="font-medium text-gray-800 dark:text-gray-200">{value}</dd>
        </div>
      ))}
    </dl>
  </div>
);

type Pending = { kind: "toggle" | "delete"; operator: PlatformUser };

// Platform operators (superadmin only)
const OperatorsPage = () => {
  const { operator: me, isSuperadmin } = usePlatformAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<PlatformUser | null>(null);
  const [editing, setEditing] = useState<PlatformUser | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const { data, isLoading, isFetching, refetch } = useQuery({ queryKey: ["platform", "users"], queryFn: usersApi.list });

  const confirm = useMutation({
    mutationFn: ({ kind, operator }: Pending) =>
      kind === "delete" ? usersApi.remove(operator._id) : usersApi.update(operator._id, { isActive: !operator.isActive }),
    onSuccess: (_result, { kind, operator }) => {
      queryClient.invalidateQueries({ queryKey: ["platform", "users"] });
      toast.success(kind === "delete" ? "Operator deleted" : operator.isActive ? "Operator deactivated" : "Operator activated");
      setPending(null);
    },
  });

  const closePending = () => {
    setPending(null);
    confirm.reset();
  };

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
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-gray-50/70 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="w-16 px-5 py-3">S/N</th>
                <th className="px-5 py-3">Operator</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                    <td colSpan={7} className="px-5 py-4"><div className="h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-white/5" /></td>
                  </tr>
                ))}
              {operators.map((user, index) => {
                const self = user._id === me?._id;
                const manageable = isSuperadmin && !self;
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
                    <td className="px-5 py-3.5"><PhoneText phone={user.phone} /></td>
                    <td className="px-5 py-3.5"><RoleBadge role={user.role} /></td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-gray-600 dark:text-gray-400">{formatDate(user.lastLoginAt, true)}</td>
                    <td className="px-5 py-3.5"><StatusPill isActive={user.isActive} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1.5">
                        <IconAction label={`View ${user.email}`} icon={<FiEye />} onClick={() => setViewing(user)} />
                        {/* Your own account is edited on your profile, behind your password */}
                        {self && <IconAction label="Edit your profile" icon={<FiEdit2 />} tone="amber" to="/platform/profile" />}
                        {manageable && (
                          <>
                            <IconAction label={`Edit ${user.email}`} icon={<FiEdit2 />} tone="amber" onClick={() => setEditing(user)} />
                            <IconAction
                              label={`${user.isActive ? "Deactivate" : "Activate"} ${user.email}`}
                              icon={<FiPower />}
                              tone={user.isActive ? "green" : "gray"}
                              onClick={() => setPending({ kind: "toggle", operator: user })}
                            />
                            <IconAction label={`Delete ${user.email}`} icon={<FiTrash2 />} tone="red" onClick={() => setPending({ kind: "delete", operator: user })} />
                          </>
                        )}
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

      {viewing && (
        <Modal title="Operator" icon={<FiEye />} onClose={() => setViewing(null)}>
          <OperatorDetails operator={viewing} />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit operator" description={editing.email} icon={<FiEdit2 />} onClose={() => setEditing(null)} width="max-w-xl">
          <EditOperatorForm operator={editing} onClose={() => setEditing(null)} />
        </Modal>
      )}

      {pending && (
        <Modal
          title={pending.kind === "delete" ? "Delete operator" : pending.operator.isActive ? "Deactivate operator" : "Activate operator"}
          icon={pending.kind === "delete" ? <FiTrash2 /> : <FiPower />}
          onClose={closePending}
        >
          <div className="space-y-5">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {pending.kind === "delete"
                ? <>Permanently delete <strong className="text-gray-900 dark:text-white/90">{pending.operator.name}</strong> ({pending.operator.email})? They are signed out at once, and this cannot be undone.</>
                : pending.operator.isActive
                  ? <><strong className="text-gray-900 dark:text-white/90">{pending.operator.name}</strong> is signed out of every device and cannot sign in until activated again.</>
                  : <><strong className="text-gray-900 dark:text-white/90">{pending.operator.name}</strong> can sign in to the console again.</>}
            </p>

            {confirm.isError && <p role="alert" className={errorBoxClass}>{errorMessage(confirm.error, "Could not update the operator")}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closePending} className={secondaryButtonClass}>Cancel</button>
              <button
                type="button"
                disabled={confirm.isPending}
                onClick={() => confirm.mutate(pending)}
                className={pending.kind === "delete" ? dangerButtonClass : primaryButtonClass}
              >
                {confirm.isPending
                  ? "Working…"
                  : pending.kind === "delete" ? "Yes, delete" : pending.operator.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default OperatorsPage;
