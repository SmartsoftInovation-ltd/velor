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
  /** The store owner's account, added by the list and detail endpoints */
  owner?: { name: string; email: string; phone: string } | null;
  /** The seller's logo from their Site Information, added by the list endpoint; "" when none */
  logoUrl?: string;
  createdAt: string;
}

export type DomainStatus = "pending" | "verifying" | "active" | "failed";

/** A storefront hostname mapped to a seller; it serves traffic only once active */
export interface TenantDomain {
  _id: string;
  host: string;
  status: DomainStatus;
  isPrimary: boolean;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  failureReason: string;
  createdAt: string;
  /** The TXT record the seller publishes to prove they own the host */
  dnsRecord: { type: "TXT"; name: string; value: string };
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
  /** Where the sign-in code is texted; null on accounts made before operators had one */
  phone?: string | null;
  role: "superadmin" | "support";
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}
