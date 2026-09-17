jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

const nodemailer = require("nodemailer");
const { sendEmail, resetMailTransport } = require("../../src/helpers/nodemailer");

describe("helpers/nodemailer", () => {
  const sendMail = jest.fn();
  const envBackup = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    resetMailTransport();
    nodemailer.createTransport.mockReturnValue({ sendMail });
    sendMail.mockResolvedValue({ messageId: "msg-1" });
    process.env.HOST_MAIL = "store@example.com";
    process.env.HOST_APP_PASSWORD = "app-password";
    process.env.MAIL_FROM_NAME = "Velor";
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  it("builds the transport from environment credentials", async () => {
    await sendEmail("to@example.com", "Subject", "<p>hi</p>");

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: { user: "store@example.com", pass: "app-password" },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: "Velor <store@example.com>",
      replyTo: undefined,
      to: "to@example.com",
      subject: "Subject",
      html: "<p>hi</p>",
    });
  });

  it("returns the message id", async () => {
    await expect(sendEmail("to@example.com", "S", "h")).resolves.toBe("msg-1");
  });

  it("reuses one transport across sends", async () => {
    await sendEmail("a@example.com", "S", "h");
    await sendEmail("b@example.com", "S", "h");
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });

  it("does not send when credentials are missing", async () => {
    delete process.env.HOST_APP_PASSWORD;

    await expect(sendEmail("to@example.com", "S", "h")).resolves.toBeNull();
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it("throws on missing credentials when throwOnError is set", async () => {
    delete process.env.HOST_MAIL;

    await expect(
      sendEmail("to@example.com", "S", "h", { throwOnError: true }),
    ).rejects.toThrow(/mail is not configured/i);
  });

  it("uses the resolved tenant config (from, replyTo, SMTP transport) and one transport per config", async () => {
    const config = require("../../src/integrations/config");
    const spy = jest.spyOn(config, "getMailConfig").mockResolvedValue({
      transport: { host: "smtp.pizza.test", port: 465, secure: true, auth: { user: "shop@pizza.test", pass: "p" } },
      from: "Pizza Shop <shop@pizza.test>",
      replyTo: "hello@pizza.test",
    });

    await sendEmail("to@example.com", "S", "h");
    await sendEmail("to2@example.com", "S", "h");

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp.pizza.test", port: 465, secure: true, auth: { user: "shop@pizza.test", pass: "p" },
    });
    expect(sendMail).toHaveBeenLastCalledWith({
      from: "Pizza Shop <shop@pizza.test>", replyTo: "hello@pizza.test", to: "to2@example.com", subject: "S", html: "h",
    });
    spy.mockRestore();
  });

  it("surfaces EMAIL_NOT_CONFIGURED only with throwOnError", async () => {
    const config = require("../../src/integrations/config");
    const error = Object.assign(new Error("Email is not configured for this store"), { code: "EMAIL_NOT_CONFIGURED" });
    const spy = jest.spyOn(config, "getMailConfig").mockRejectedValue(error);

    await expect(sendEmail("to@example.com", "S", "h")).resolves.toBeNull();
    await expect(sendEmail("to@example.com", "S", "h", { throwOnError: true })).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
    spy.mockRestore();
  });

  it("swallows send failures by default and rethrows with throwOnError", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));

    await expect(sendEmail("to@example.com", "S", "h")).resolves.toBeNull();
    await expect(
      sendEmail("to@example.com", "S", "h", { throwOnError: true }),
    ).rejects.toThrow("smtp down");
  });
});
