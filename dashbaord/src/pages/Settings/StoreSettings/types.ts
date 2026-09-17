export type FieldType = "string" | "uri" | "email" | "boolean" | "number" | "integer" | "enum" | "secret";

export interface SchemaField {
  name: string;
  type: FieldType;
  required: boolean;
  default?: string | number | boolean;
  values?: string[];
  min?: number;
  max?: number;
  pattern?: string;
}

export interface SectionSchema {
  key: string;
  path: string;
  testable: boolean;
  fields: SchemaField[];
}

export interface MaskedSecret {
  isSet: boolean;
  last4?: string;
  updatedAt?: string | null;
}

export type SectionValues = Record<string, string | number | boolean | MaskedSecret | null | undefined>;

export interface TestResult {
  ok: boolean;
  detail?: unknown;
  error?: string;
}
