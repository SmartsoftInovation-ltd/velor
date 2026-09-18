import { useAuth } from "../../context/AuthContext";

// Read-only: the account's own details come from the API, and there is no
// endpoint for staff to edit them here. The template's version showed a fake
// person and an "Edit" dialog whose save only logged to the console.
const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-sm font-medium text-gray-800 dark:text-white/90">{value || "—"}</p>
  </div>
);

export default function UserInfoCard() {
  const { user, tenant, isOwner } = useAuth();
  if (!user) return null;

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
        Account
      </h4>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
        <Field label="Name" value={user.name} />
        <Field label="Email" value={user.email} />
        <Field label="Phone" value={user.phone} />
        <Field label="Store" value={tenant?.name} />
        <Field
          label="Role"
          value={isOwner ? "Owner" : user.roles?.map((r) => r.name).join(", ")}
        />
        <Field label="Status" value={user.isActive ? "Active" : "Inactive"} />
      </div>

      <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
        To change these details, ask the store owner to update your staff account.
      </p>
    </div>
  );
}
