import { describe, expect, it } from "vitest";
import { bdMobileError, cleanPhone } from "./bdPhone";

describe("bdMobileError", () => {
  it.each(["01712345678", "01312345678", "01912345678", "+8801712345678", "8801712345678", "017 1234-5678"])(
    "accepts %s",
    (phone) => expect(bdMobileError(phone, { required: true })).toBeUndefined(),
  );

  it.each(["01212345678", "0171234567", "017123456789", "1712345678", "+8811712345678", "01712abc678"])(
    "rejects %s",
    (phone) => expect(bdMobileError(phone)).toMatch(/valid Bangladeshi number/),
  );

  it("needs a value only when required", () => {
    expect(bdMobileError("", { required: true })).toBe("Mobile number is required");
    expect(bdMobileError("  ")).toBeUndefined();
    expect(bdMobileError("", { label: "Secondary mobile number", required: true })).toBe("Secondary mobile number is required");
  });

  it("drops spaces and dashes", () => {
    expect(cleanPhone("017 1234-5678")).toBe("01712345678");
  });
});
