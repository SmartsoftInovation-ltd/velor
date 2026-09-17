import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import PermissionsPage from "./pages/PermissionsPage";
import TenantDetailPage from "./pages/TenantDetailPage";
import TenantsPage from "./pages/TenantsPage";
import UsersPage from "./pages/UsersPage";

const RequireAuth = ({ children, superadmin = false }: { children: ReactNode; superadmin?: boolean }) => {
  const { user, loading, isSuperadmin } = useAuth();
  if (loading) return <p className="p-6 text-sm text-slate-500">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (superadmin && !isSuperadmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<TenantsPage />} />
        <Route path="/tenants/:tenantId" element={<TenantDetailPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/users" element={<RequireAuth superadmin><UsersPage /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </BrowserRouter>
);

export default App;
