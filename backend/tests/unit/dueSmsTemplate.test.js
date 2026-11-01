const { renderDueSms, DEFAULT_DUE_TEMPLATE, hasTokens } = require("../../src/utils/dueSmsTemplate.util");
const { smsLength } = require("../../src/utils/smsLength.util");

describe("due SMS template", () => {
  it("puts in the name and the due as a whole number with commas", () => {
    expect(renderDueSms(DEFAULT_DUE_TEMPLATE, { name: "Rina Akter", due: 5000 })).toBe(
      "Dear Rina Akter Sir/Mam, Your overall due balance is 5,000 taka. Please payment your due balance as soon as possible.",
    );
    expect(renderDueSms("#due#", { due: 1234.6 })).toBe("1,235");
  });

  it("shortens a long name so the text still fits one SMS", () => {
    const name = "Mohammad Abdur Rahman Chowdhury Siddiqui Talukder Bhuiyan";
    const text = renderDueSms(DEFAULT_DUE_TEMPLATE, { name, due: 125000 });
    expect(smsLength(text).length).toBeLessThanOrEqual(160);
    expect(text).toMatch(/^Dear Mohammad /);
    expect(text).toContain("125,000 taka");
  });

  it("is null when the template alone is too long", () => {
    expect(renderDueSms("x".repeat(170) + " #name#", { name: "A" })).toBeNull();
  });

  it("knows when a message is a template", () => {
    expect(hasTokens(DEFAULT_DUE_TEMPLATE)).toBe(true);
    expect(hasTokens("Please pay")).toBe(false);
  });
});
