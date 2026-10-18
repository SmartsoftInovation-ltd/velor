export type TenantStatus = "provisioning" | "active" | "suspended" | "cancelled";

export type BillingCycle = "monthly" | "yearly" | "one-time";

/** What the platform sells this store for: price per cycle, next renewal */
export interface TenantBilling {
  price: number;
  cycle: BillingCycle;
  startedAt: string | null;
  renewsAt: string | null;
}

export interface Tenant {
  _id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: string;
  limits?: { maxStaff?: number | null };
  billing?: TenantBilling;
  webhookKey: string;
  statusReason?: string;
  ownerUserId?: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type FieldType = "string" | "uri" | "email" | "boolean" | "number" | "integer" | "enum" | "secret";

export interface SettingsField {
  name: string;
  type: FieldType;
  required: boolean;
  default?: string | number | boolean;
  values?: string[];
  min?: number;
  max?: number;
  pattern?: string;
}

export interface SettingsSectionSchema {
  key: string;
  path: string;
  testable: boolean;
  fields: SettingsField[];
}

export interface MaskedSecret {
  isSet: boolean;
  last4: string;
  updatedAt: string | null;
}

export type SectionValues = Record<string, string | number | boolean | MaskedSecret | null>;

export interface TestResult {
  ok: boolean;
  detail?: unknown;
  error?: string;
}

export interface AuditEntry {
  _id: string;
  action: string;
  actorEmail: string;
  changes: string[];
  createdAt: string;
}

export interface PlatformUser {
  _id: string;
  name: string;
  email: string;
  role: "superadmin" | "support";
  isActive: boolean;
  lastLoginAt?: string | null;
}
