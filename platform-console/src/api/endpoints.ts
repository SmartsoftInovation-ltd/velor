import { api } from "./client";
import type {
  AuditEntry,
  Page,
  Permission,
  PlatformUser,
  SectionValues,
  SettingsSectionSchema,
  Tenant,
  TenantStatus,
  TestResult,
} from "./types";

const data = <T>(promise: Promise<{ data: { data: T } }>) => promise.then((res) => res.data.data);

export interface OwnerInput {
  name: string;
  email: string;
  phone: string;
  password?: string;
}

export interface ProvisionResult {
  tenant: Tenant;
  owner: { _id: string; name: string; email: string; phone: string; temporaryPassword?: string };
  loginUrl: string;
}

export interface Webhooks {
  sslcommerz: Record<string, string>;
  pathao: string;
  steadfast: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    data<{ accessToken: string; user: PlatformUser }>(api.post("/auth/login", { email, password })),
  me: () => data<PlatformUser>(api.get("/auth/me")),
  logout: () => api.post("/auth/logout"),
};

export const tenantsApi = {
  list: (params: { status?: TenantStatus | ""; search?: string; page?: number; limit?: number }) =>
    data<Page<Tenant>>(api.get("/tenants", { params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined)) })),
  get: (id: string) => data<Tenant>(api.get(`/tenants/${id}`)),
  provision: (body: { name: string; slug: string; plan?: string; limits?: { maxStaff: number | null }; owner: OwnerInput }) =>
    data<ProvisionResult>(api.post("/tenants", body)),
  update: (id: string, body: { name?: string; plan?: string; limits?: { maxStaff: number | null } }) =>
    data<Tenant>(api.patch(`/tenants/${id}`, body)),
  suspend: (id: string, reason: string) => data<Tenant>(api.post(`/tenants/${id}/suspend`, { reason })),
  activate: (id: string) => data<Tenant>(api.post(`/tenants/${id}/activate`, {})),
  audit: (id: string, page = 1) => data<Page<AuditEntry>>(api.get(`/tenants/${id}/audit`, { params: { page, limit: 20 } })),
};

export const settingsApi = {
  schema: () => data<SettingsSectionSchema[]>(api.get("/settings/schema")),
  get: (tenantId: string) =>
    data<{ settings: Record<string, SectionValues>; features: Record<string, unknown>; version: number }>(api.get(`/tenants/${tenantId}/settings`)),
  update: (tenantId: string, path: string, patch: Record<string, unknown>) =>
    data<{ changes: string[]; version: number }>(api.patch(`/tenants/${tenantId}/settings/${path}`, patch)),
  test: (tenantId: string, path: string) => data<TestResult>(api.post(`/tenants/${tenantId}/settings/${path}/test`)),
  webhooks: (tenantId: string) => data<Webhooks>(api.get(`/tenants/${tenantId}/settings/webhooks`)),
};

export const permissionsApi = {
  list: () => data<Permission[]>(api.get("/permissions")),
  create: (permissionName: string) => data<Permission>(api.post("/permissions", { permissionName })),
  update: (id: string, body: { permissionName?: string; isActive?: boolean }) => data<Permission>(api.patch(`/permissions/${id}`, body)),
  remove: (id: string) => api.delete(`/permissions/${id}`),
};

export const usersApi = {
  list: () => data<PlatformUser[]>(api.get("/users")),
  create: (body: { name: string; email: string; password: string; role: PlatformUser["role"] }) => data<PlatformUser>(api.post("/users", body)),
  update: (id: string, body: Partial<{ name: string; password: string; role: PlatformUser["role"]; isActive: boolean }>) =>
    data<PlatformUser>(api.patch(`/users/${id}`, body)),
};
