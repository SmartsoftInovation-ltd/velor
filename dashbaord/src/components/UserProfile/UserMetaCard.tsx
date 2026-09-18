import { useAuth } from "../../context/AuthContext";

// The signed-in account, as the API reports it. This card used to show a
// template's fake person ("Team Manager", "Arizona, United States") and link out
// to the template vendor's social accounts.
export default function UserMetaCard() {
  const { user, tenant, isOwner } = useAuth();
  if (!user) return null;

  const roleLabel = isOwner ? "Owner" : user.roles?.map((r) => r.name).join(", ") || "Staff";

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col items-center gap-6 xl:flex-row">
        <div className="w-20 h-20 overflow-hidden border border-gray-200 rounded-full dark:border-gray-800">
          {user.image?.url ? (
            <img src={user.image.url} alt={user.name} className="object-cover w-full h-full" />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-xl font-semibold text-gray-500 bg-gray-100 dark:bg-white/[0.03] dark:text-gray-400">
              {user.name?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="text-center xl:text-left">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">
            {user.name}
          </h4>
          <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
            <p className="text-sm text-gray-500 dark:text-gray-400">{roleLabel}</p>
            {tenant?.name && (
              <>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{tenant.name}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
