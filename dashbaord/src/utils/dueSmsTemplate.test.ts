import { describe, expect, it } from "vitest";
import { DUE_SMS_TEMPLATE, hasDueTokens, renderDueSms } from "./dueSmsTemplate";
import { smsLength } from "./smsLength";

describe("due SMS template", () => {
  it("fills in the customer's real name and due", () => {
    expect(renderDueSms(DUE_SMS_TEMPLATE, { fullName: "Rina Akter", openingDues: 5000 })).toBe(
      "Dear Rina Akter Sir/Mam, Your overall due balance is 5,000 taka. Please payment your due balance as soon as possible.",
    );
  });

  it("keeps a long name inside one SMS", () => {
    const text = renderDueSms(DUE_SMS_TEMPLATE, {
      fullName: "Mohammad Abdur Rahman Chowdhury Siddiqui Talukder Bhuiyan",
      openingDues: 125000,
    });
    expect(smsLength(text).length).toBeLessThanOrEqual(160);
    expect(text).toContain("125,000 taka");
  });

  it("is plain English, so it gets the full 160 characters", () => {
    expect(smsLength(DUE_SMS_TEMPLATE).unicode).toBe(false);
    expect(hasDueTokens(DUE_SMS_TEMPLATE)).toBe(true);
  });
});
