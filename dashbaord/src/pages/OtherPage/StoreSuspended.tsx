import { getWorkspace } from "../../lib/session";

// Shown when the API reports TENANT_SUSPENDED: the store's subscription is on hold
const StoreSuspended = () => {
  const workspace = getWorkspace();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 dark:bg-gray-900">
      <h1 className="mb-2 text-3xl font-bold text-gray-800 dark:text-white">Store unavailable</h1>
      <p className="mb-8 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
        {workspace ? <>The store <strong>{workspace}</strong> is suspended.</> : "This store is suspended."} Please contact
        support to restore access.
      </p>
      <a
        href="/signin"
        className="rounded-xl border border-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        Sign in to another store
      </a>
    </div>
  );
};

export default StoreSuspended;
