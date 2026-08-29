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
  const { isSuperAdmin, can, isLoading, user } = useAuth();

  // Still fetching user — show nothing until auth resolves
  if (isLoading) return null;

  // Auth fetch completed but user is null — token is invalid/expired
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
