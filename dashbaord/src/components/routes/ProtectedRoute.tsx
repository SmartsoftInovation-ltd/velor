import { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../../context/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  module?: string;
  // Page covering several modules — allowed when the user has any one of them.
  anyOfModules?: string[];
  action?: string;
}

const ProtectedRoute = ({
  children,
  module,
  anyOfModules,
  action,
}: ProtectedRouteProps) => {
  const token = localStorage.getItem("accessToken");

  if (!token) {
    return <Navigate to="/signin" replace />;
  }

  if ((module || anyOfModules?.length) && action) {
    return (
      <PermissionGuard
        module={module}
        anyOfModules={anyOfModules}
        action={action}
      >
        {children}
      </PermissionGuard>
    );
  }

  return <>{children}</>;
};

// Separate inner component so useAuth() is only called when a permission check is needed
const PermissionGuard = ({
  children,
  module,
  anyOfModules,
  action,
}: {
  children: ReactNode;
  module?: string;
  anyOfModules?: string[];
  action: string;
}) => {
  const { isSuperAdmin, can, isLoading, user, loadFailed, refreshAuth } = useAuth();

  // Still fetching user — show nothing until auth resolves
  if (isLoading) return null;

  // The session is fine but the server could not be reached: stay on the page
  if (!user && loadFailed) {
    return (
      <div role="alert" className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm font-semibold text-gray-800 dark:text-white/90">Could not reach the server</p>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">Check your connection and try again. You are still signed in.</p>
        <button
          type="button"
          onClick={() => refreshAuth()}
          className="shine rounded bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-600"
        >
          Try again
        </button>
      </div>
    );
  }

  // Auth fetch completed but user is null — the session is over
  if (!user) return <Navigate to="/signin" replace />;

  // User is superadmin — bypass all permission checks
  if (isSuperAdmin) return <>{children}</>;

  // Check specific permission — any one of anyOfModules is enough.
  const allowed = anyOfModules?.length
    ? anyOfModules.some((m) => can(m, action))
    : !!module && can(module, action);

  if (!allowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
