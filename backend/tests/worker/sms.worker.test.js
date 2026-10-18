const nock = require("nock");
const mongoose = require("mongoose");
const { useWorkerEnv } = require("../helpers/workerEnv");
const { waitForJob, eventually } = require("../helpers/wait");
const { runForTenant } = require("../../src/tenancy/context");
const { smsQueue } = require("../../src/queues/sms.queue");
const { startSmsWorker, processSmsJob } = require("../../src/workers/sms.worker");
const SmsLog = require("../../src/models/smsLog.model");
const settings = require("../../src/settings/settings.service");

const GATEWAY = "http://sms-gateway.example.test";

describe("SMS worker (queue: due-sms)", () => {
  const env = useWorkerEnv();
  const tenantId = new mongoose.Types.ObjectId();
  const inTenant = (fn) => runForTenant(tenantId, fn);

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);
  });
  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(async () => {
    await settings.updateSection(tenantId, "sms", { enabled: true, apiUrl: `${GATEWAY}/api/smsapi`, apiKey: "dummy-sms-key", senderId: "SHOP" });
    settings.clearSettingsCache();
  });
  afterEach(() => nock.cleanAll());

  const makeLog = (phones) =>
    inTenant(() => SmsLog.create({ type: "bulk", recipientType: "due", message: "Your due is 500", totalCount: phones.length, recipients: phones.map((phone) => ({ phone })) }));
  const enqueue = (log, phones, opts) =>
    inTenant(() => smsQueue.add("send-bulk-sms", { logId: log._id.toString(), message: "Your due is 500", recipients: phones.map((phone, index) => ({ phone, index })) }, opts));
  const logNow = (log) => inTenant(() => SmsLog.findById(log._id).lean());

  it("is configured with 3 attempts and exponential backoff", () => {
    expect(smsQueue.defaultJobOptions).toMatchObject({ attempts: 3, backoff: { type: "exponential", delay: 3000 } });
  });

  it("sends to every recipient through the tenant's gateway and marks the log completed", async () => {
    const sent = [];
    nock(GATEWAY).post("/api/smsapi", (body) => sent.push(body)).times(3).reply(200, { response_code: 202 });
    env.track(startSmsWorker());
    const phones = ["01711111111", "01722222222", "01733333333"];
    const log = await makeLog(phones);
    const job = await enqueue(log, phones);
    const { state, job: done } = await waitForJob(smsQueue, job.id);
    expect(state).toBe("completed");
    expect(done.returnvalue).toMatchObject({ sentCount: 3, failedCount: 0, status: "completed" });
    expect(sent.map((b) => b.number).sort()).toEqual(phones);
    expect(sent[0]).toMatchObject({ api_key: "dummy-sms-key", senderid: "SHOP", message: "Your due is 500" });
    const stored = await logNow(log);
    expect(stored).toMatchObject({ status: "completed", sentCount: 3, failedCount: 0 });
    expect(stored.recipients.map((r) => r.status)).toEqual(["sent", "sent", "sent"]);
  });

  it("records a gateway failure per recipient: partial when some fail, failed when all do", async () => {
    nock(GATEWAY).post("/api/smsapi", (b) => b.number === "01711111111").reply(200, { response_code: 202 });
    nock(GATEWAY).post("/api/smsapi", (b) => b.number === "01722222222").reply(500, { error: "gateway down" });
    env.track(startSmsWorker());
    const log = await makeLog(["01711111111", "01722222222"]);
    const job = await enqueue(log, ["01711111111", "01722222222"]);
    await waitForJob(smsQueue, job.id);
    const stored = await logNow(log);
    expect(stored).toMatchObject({ status: "partial", sentCount: 1, failedCount: 1 });
    expect(stored.recipients[1]).toMatchObject({ status: "failed" });
    expect(stored.recipients[1].error).toMatch(/500/);

    nock(GATEWAY).post("/api/smsapi").reply(503, {});
    const log2 = await makeLog(["01799999999"]);
    const job2 = await enqueue(log2, ["01799999999"]);
    await waitForJob(smsQueue, job2.id);
    expect(await logNow(log2)).toMatchObject({ status: "failed", sentCount: 0, failedCount: 1 });
  });

  it("an unconfigured store fails each send without calling any gateway", async () => {
    await settings.updateSection(tenantId, "sms", { enabled: false });
    settings.clearSettingsCache();
    env.track(startSmsWorker());
    const log = await makeLog(["01711111111"]);
    const job = await enqueue(log, ["01711111111"]);
    await waitForJob(smsQueue, job.id);
    const stored = await logNow(log);
    expect(stored.status).toBe("failed");
    expect(stored.recipients[0].error).toMatch(/not (been )?(set up|configured)/i);
  });

  it("an invalid payload (no recipients) fails cleanly after its attempts", async () => {
    env.track(startSmsWorker());
    const log = await makeLog([]);
    const job = await inTenant(() => smsQueue.add("send-bulk-sms", { logId: log._id.toString(), message: "x" }, { attempts: 2, backoff: { type: "fixed", delay: 10 } }));
    const { state, job: done } = await waitForJob(smsQueue, job.id);
    expect(state).toBe("failed");
    expect(done.attemptsMade).toBe(2);
    expect(done.failedReason).toMatch(/length|undefined/);
  });

  it("close() lets an in-flight send finish (graceful shutdown)", async () => {
    nock(GATEWAY).post("/api/smsapi").delay(400).reply(200, { response_code: 202 });
    const worker = startSmsWorker();
    const log = await makeLog(["01711111111"]);
    const job = await enqueue(log, ["01711111111"]);
    await eventually(async () => expect(await job.getState()).toBe("active"), { timeout: 3000 });
    await worker.close();
    expect(await job.getState()).toBe("completed");
    expect((await logNow(log)).status).toBe("completed");
  });

  // BUG-061: a re-run job (retry after a crash, a stalled job) sends again to
  // recipients its log already marks "sent" — customers get duplicate SMS
  test.failing("processing the same job twice does not text a recipient twice [BUG-061]", async () => {
    let calls = 0;
    nock(GATEWAY).post("/api/smsapi").times(2).reply(200, () => {
      calls += 1;
      return { response_code: 202 };
    });
    const log = await makeLog(["01711111111"]);
    const job = { id: "dup", data: { logId: log._id.toString(), message: "x", recipients: [{ phone: "01711111111", index: 0 }] } };
    await inTenant(() => processSmsJob(job));
    await inTenant(() => processSmsJob(job));
    expect(calls).toBe(1);
  });
});
