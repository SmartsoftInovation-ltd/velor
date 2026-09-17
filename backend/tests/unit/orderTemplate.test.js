const { orderTemplate } = require("../../src/emailTemplate/orderTemplate");

describe("orderTemplate links", () => {
  const order = { invoiceId: "PZS-1", finalAmount: 100, createdAt: new Date() };
  const shipping = { fullName: "Rahim", phone: "01711000000", address: "Dhaka" };
  const invoice = { invoiceId: "PZS-1" };

  it("uses the store links passed in", () => {
    const html = orderTemplate(order, shipping, invoice, [], {
      storefrontUrl: "https://pizza.test",
      facebookUrl: "https://facebook.com/pizza",
    });
    expect(html).toContain('href="https://pizza.test"');
    expect(html).toContain('href="https://facebook.com/pizza"');
  });
});
