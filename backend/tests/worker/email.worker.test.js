const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const { useWorkerEnv } = require("../helpers/workerEnv");
const { waitForJob } = require("../helpers/wait");
const { runForTenant } = require("../../src/tenancy/context");
const { emailQueue } = require("../../src/queues/email.queue");
const { startEmailWorker } = require("../../src/workers/email.worker");
const { resetMailTransport } = require("../../src/helpers/nodemailer");
const settings = require("../../src/settings/settings.service");

// SMTP is not HTTP, so instead of nock the transport is replaced: every mail
// the worker would send is captured here, and a send can be made to fail.
describe("email worker (queue: email)", () => {
  const env = useWorkerEnv();
  const tenantId = new mongoose.Types.ObjectId();
  let sent;
  let failNext;

  beforeEach(async () => {
    sent = [];
    failNext = false;
    resetMailTransport();
    jest.spyOn(nodemailer, "createTransport").mockImplementation((options) => ({
      sendMail: async (mail) => {
        if (failNext) throw new Error("SMTP 421 service not available");
        sent.push({ options, mail });
        return { messageId: `<${sent.length}@test>` };
      },
    }));
    await settings.updateSection(tenantId, "email", {
      mode: "smtp", fromName: "Pizza Shop", fromEmail: "shop@pizza.example", smtpHost: "smtp.pizza.example", smtpPort: 587, smtpUser: "mailer", smtpPassword: "dummy-smtp-pass",
    });
    settings.clearSettingsCache();
  });

  const enqueue = (data, opts) => runForTenant(tenantId, () => emailQueue.add("send-sales-invoice", data, opts));

  it("is configured with 3 attempts and exponential backoff", () => {
    expect(emailQueue.defaultJobOptions).toMatchObject({ attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  });

  it("sends through the tenant's own SMTP server and From address", async () => {
    env.track(startEmailWorker());
    const job = await enqueue({ to: "buyer@example.com", subject: "Invoice INV-1", html: "<p>Thanks</p>" });
    const { state, job: done } = await waitForJob(emailQueue, job.id);
    expect(state).toBe("completed");
    expect(done.returnvalue).toEqual({ to: "buyer@example.com", messageId: "<1@test>" });
    expect(sent).toHaveLength(1);
    expect(sent[0].options).toMatchObject({ host: "smtp.pizza.example", port: 587, auth: { user: "mailer", pass: "dummy-smtp-pass" } });
    expect(sent[0].mail).toMatchObject({ from: "Pizza Shop <shop@pizza.example>", to: "buyer@example.com", subject: "Invoice INV-1" });
  });

  it("completes as skipped when there is no recipient (no retry, nothing sent)", async () => {
    env.track(startEmailWorker());
    const job = await enqueue({ subject: "x", html: "y" });
    const { state, job: done } = await waitForJob(emailQueue, job.id);
    expect(state).toBe("completed");
    expect(done.returnvalue).toEqual({ skipped: true, reason: "no recipient" });
    expect(sent).toHaveLength(0);
  });

  // BUG-062: sendEmail() swallows SMTP errors and returns null, so the job
  // "completes" — the queue's 3 attempts never happen and the mail is lost
  test.failing("an SMTP failure is retried and the job ends failed, not completed [BUG-062]", async () => {
    failNext = true;
    env.track(startEmailWorker());
    const job = await enqueue({ to: "buyer@example.com", subject: "x", html: "y" }, { attempts: 2, backoff: { type: "fixed", delay: 10 } });
    const { state, job: done } = await waitForJob(emailQueue, job.id);
    expect(state).toBe("failed");
    expect(done.attemptsMade).toBe(2);
  });

  it("a store that turned email off sends nothing", async () => {
    await settings.updateSection(tenantId, "email", { mode: "disabled" });
    settings.clearSettingsCache();
    env.track(startEmailWorker());
    const job = await enqueue({ to: "buyer@example.com", subject: "x", html: "y" });
    await waitForJob(emailQueue, job.id);
    expect(sent).toHaveLength(0);
  });
});
