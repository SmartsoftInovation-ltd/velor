import { platformApi as api } from "./api";
import type {
  AuditEntry,
  BillingCycle,
  Page,
  PlatformUser,
  SectionValues,
  SettingsSectionSchema,
  Tenant,
  TenantBilling,
  TenantStatus,
  TestResult,
} from "./types";

const data = <T>(promise: Promise<{ data: { data: T } }>) => promise.then((res) => res.data.data);

export interface OwnerInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface OwnerSummary {
  _id: string;
  name: string;
  email: string;
  phone: string;
}

// Whether the owner's sign-in details went out by SMS (the only channel)
export interface CredentialsNotice {
  channel: "sms" | null;
  sent: boolean;
}

export interface ProvisionResult {
  tenant: Tenant;
  owner: OwnerSummary;
  loginUrl: string;
  notification: CredentialsNotice;
}

export interface Webhooks {
  sslcommerz: Record<string, string>;
  pathao: string;
  steadfast: string;
}

export interface PlatformDashboard {
  sellers: {
    total: number;
    byStatus: Record<TenantStatus, number>;
    byCycle: Record<BillingCycle, number>;
    newThisMonth: number;
  };
  revenue: {
    /** Active sellers' monthly price + yearly price / 12 */
    monthlyRecurring: number;
    yearlyRecurring: number;
    oneTimeTotal: number;
    /** Price of sellers whose billing started this month */
    soldThisMonth: number;
  };
  renewals: { windowDays: number; due: number; dueAmount: number; overdue: number; overdueAmount: number };
  /** Last 12 months, oldest first: price of sellers whose billing started that month */
  salesByMonth: { month: string; amount: number; sellers: number }[];
  list: {
    _id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    plan: string;
    price: number;
    cycle: BillingCycle;
    startedAt: string | null;
    renewsAt: string | null;
    /** Negative once the renewal date has passed; null with no renewal */
    daysLeft: number | null;
    staff: number;
    maxStaff: number | null;
    owner: { name: string; email: string; phone: string } | null;
    createdAt: string;
  }[];
  generatedAt: string;
}

export const dashboardApi = {
  get: () => data<PlatformDashboard>(api.get("/dashboard")),
};

export type SellerPage = Page<Tenant> & { counts: Record<TenantStatus | "all", number> };

export interface OtpChallenge {
  challengeId: string;
  /** Operator phone, masked: 01******62 */
  phone: string;
  expiresInSeconds: number;
}

export interface PlatformSession {
  accessToken: string;
  user: PlatformUser;
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  password?: string;
  /** Required by the API for an email or password change */
  currentPassword?: string;
}

/** A password change reissues this device's tokens; otherwise accessToken is null */
export interface ProfileUpdateResult {
  user: PlatformUser;
  accessToken: string | null;
}

export const authApi = {
  // Step 1: the password only starts a challenge — the code opens the session
  login: (body: { email: string; password: string }) => data<OtpChallenge>(api.post("/auth/login", body)),
  verifyOtp: (body: { challengeId: string; code: string }) => data<PlatformSession>(api.post("/auth/verify-otp", body)),
  resendOtp: (body: { email: string; password: string; challengeId?: string }) =>
    data<OtpChallenge>(api.post("/auth/resend-otp", body)),
  me: () => data<PlatformUser>(api.get("/auth/me")),
  logout: () => api.post("/auth/logout"),
  // Self-service: every operator owns their own account, support role included
  updateMe: (body: ProfileUpdate) => data<ProfileUpdateResult>(api.patch("/auth/me", body)),
};

export const tenantsApi = {
  list: (params: { status?: TenantStatus | ""; search?: string; page?: number; limit?: number }) =>
    data<SellerPage>(api.get("/tenants", { params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== undefined)) })),
  get: (id: string) => data<Tenant>(api.get(`/tenants/${id}`)),
  provision: (body: { name: string; slug: string; plan?: string; limits?: { maxStaff: number | null }; billing?: Partial<TenantBilling>; owner: OwnerInput }) =>
    data<ProvisionResult>(api.post("/tenants", body)),
  update: (id: string, body: { name?: string; plan?: string; limits?: { maxStaff: number | null }; billing?: Partial<TenantBilling> }) =>
    data<Tenant>(api.patch(`/tenants/${id}`, body)),
  suspend: (id: string, reason: string) => data<Tenant>(api.post(`/tenants/${id}/suspend`, { reason })),
  activate: (id: string) => data<Tenant>(api.post(`/tenants/${id}/activate`, {})),
  setOwnerPassword: (id: string, body: { password: string; notify: boolean }) =>
    data<{ owner: OwnerSummary; notification: CredentialsNotice }>(api.post(`/tenants/${id}/owner/password`, body)),
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

export const usersApi = {
  list: () => data<PlatformUser[]>(api.get("/users")),
  create: (body: { name: string; email: string; password: string; role: PlatformUser["role"] }) => data<PlatformUser>(api.post("/users", body)),
  update: (id: string, body: Partial<{ name: string; password: string; role: PlatformUser["role"]; isActive: boolean }>) =>
    data<PlatformUser>(api.patch(`/users/${id}`, body)),
};
