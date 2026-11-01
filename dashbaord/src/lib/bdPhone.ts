// Bangladeshi mobile numbers: 01 + operator digit 3–9 + 8 digits, with or
// without the 880 / +880 country code. Same rule as the backend's
// customer.validation.js, so the form catches a bad number before saving.
export const BD_MOBILE_PATTERN = /^(?:\+?880|0)1[3-9]\d{8}$/;

export const BD_MOBILE_PLACEHOLDER = "01XXXXXXXXX";

// Typed spaces and dashes are not part of the number
export const cleanPhone = (value: string) => value.replace(/[\s-]/g, "");

/**
 * The error for a typed number, or undefined when it is fine.
 * An empty value is only an error when the field is required.
 */
export const bdMobileError = (
  value: string,
  { label = "Mobile number", required = false }: { label?: string; required?: boolean } = {},
): string | undefined => {
  const phone = cleanPhone(value.trim());
  if (!phone) return required ? `${label} is required` : undefined;
  if (!BD_MOBILE_PATTERN.test(phone)) {
    return `${label} must be a valid Bangladeshi number, e.g. 01712345678`;
  }
  return undefined;
};
