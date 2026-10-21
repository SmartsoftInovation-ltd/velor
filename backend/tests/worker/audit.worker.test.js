const mongoose = require("mongoose");
const { useWorkerEnv } = require("../helpers/workerEnv");
const { waitForJob, eventually } = require("../helpers/wait");
const { runForTenant, runAsPlatform } = require("../../src/tenancy/context");
const { auditQueue, AUDIT_QUEUE_NAME } = require("../../src/queues/audit.queue");
const { startAuditWorker, processAuditJob } = require("../../src/workers/audit.worker");
const { auditLogModel } = require("../../src/models/auditLog.model");
const { logAudit } = require("../../src/service/audit.service");

describe("audit worker (queue: audit-log)", () => {
  const env = useWorkerEnv();
  const tenantId = new mongoose.Types.ObjectId();
  const rows = (filter = {}) => runAsPlatform(() => auditLogModel.find(filter).lean());

  const event = (overrides = {}) => ({
    action: "CREATE",
    entity: { type: "product", id: new mongoose.Types.ObjectId().toString(), label: "Shirt" },
    user: { id: new mongoose.Types.ObjectId().toString(), name: "Owner", email: "o@x.com", roles: ["owner"] },
    createdAt: new Date("2026-05-01T10:00:00Z").toISOString(),
    ...overrides,
  });

  it("is configured with 3 attempts, exponential backoff and bounded retention", () => {
    expect(auditQueue.name).toBe(AUDIT_QUEUE_NAME);
    expect(auditQueue.opts.prefix).toBe("bull-test");
    expect(auditQueue.defaultJobOptions).toMatchObject({ attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 500, removeOnFail: 5000 });
  });

  it("a valid job lands in the tenant's audit log with ObjectIds restored", async () => {
    env.track(startAuditWorker());
    const job = await runForTenant(tenantId, () => auditQueue.add("audit-event", event()));
    expect(job.data.tenantId).toBe(tenantId.toString()); // stamped by tenantAwareQueue
    const { state } = await waitForJob(auditQueue, job.id);
    expect(state).toBe("completed");

    const [row] = await rows();
    expect(row.tenantId.equals(tenantId)).toBe(true);
    expect(row.user.id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(row.entity.id).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(row.createdAt.toISOString()).toBe("2026-05-01T10:00:00.000Z");
    expect(await runForTenant(tenantId, () => auditLogModel.countDocuments())).toBe(1);
  });

  it("logAudit() end to end: redacts secrets before they reach the queue and the log", async () => {
    env.track(startAuditWorker());
    await runForTenant(tenantId, () =>
      logAudit({ action: "CREATE", entityType: "user", entityId: new mongoose.Types.ObjectId(), entityLabel: "x", after: { name: "N", password: "plain", refreshToken: "rt" } }),
    );
    await eventually(async () => expect(await rows()).toHaveLength(1), { timeout: 5000 });
    const [row] = await rows();
    expect(row.after).toMatchObject({ name: "N", password: "[REDACTED]", refreshToken: "[REDACTED]" });
  });

  it("a job without a tenant fails, is retried, and ends failed without writing anything", async () => {
    env.track(startAuditWorker());
    const job = await runAsPlatform(() => auditQueue.add("audit-event", event(), { attempts: 2, backoff: { type: "fixed", delay: 10 } }));
    const { state, job: done } = await waitForJob(auditQueue, job.id);
    expect(state).toBe("failed");
    expect(done.attemptsMade).toBe(2);
    expect(done.failedReason).toMatch(/has no tenantId/);
    expect(await rows()).toHaveLength(0);
  });

  it("in strict tenancy mode tenantJob refuses a job without a tenant before the processor runs", async () => {
    process.env.TENANCY_MODE = "strict";
    env.track(startAuditWorker());
    const job = await runAsPlatform(() => auditQueue.add("audit-event", event(), { attempts: 1 }));
    const { state, job: done } = await waitForJob(auditQueue, job.id);
    expect(state).toBe("failed");
    expect(done.failedReason).toMatch(/has no tenantId/);
  });

  it("delayed jobs wait for their delay, then run", async () => {
    env.track(startAuditWorker());
    const job = await runForTenant(tenantId, () => auditQueue.add("audit-event", event(), { delay: 400 }));
    expect(await job.getState()).toBe("delayed");
    const started = Date.now();
    await waitForJob(auditQueue, job.id, { timeout: 5000 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
    expect(await rows()).toHaveLength(1);
  });

  it("two workers on one queue process each job exactly once", async () => {
    env.track(startAuditWorker({ concurrency: 5 }));
    env.track(startAuditWorker({ concurrency: 5 }));
    const jobs = await runForTenant(tenantId, () =>
      auditQueue.addBulk(Array.from({ length: 30 }, (_, i) => ({ name: "audit-event", data: event({ entity: { type: "product", id: new mongoose.Types.ObjectId().toString(), label: `n${i}` } }) }))),
    );
    for (const job of jobs) await waitForJob(auditQueue, job.id, { timeout: 10000 });
    const all = await rows();
    expect(all).toHaveLength(30);
    expect(new Set(all.map((r) => r.entity.label)).size).toBe(30);
  });

  // BUG-060: the processor is a bare insertOne — a job that runs twice (a
  // retry after the insert succeeded but before the ack, a stalled job) writes
  // the audit entry twice
  it("processing the same job twice records the event once [BUG-060]", async () => {
    const job = { id: "same-job", data: { ...event(), tenantId: tenantId.toString() } };
    await processAuditJob(job);
    await processAuditJob(job);
    expect(await rows()).toHaveLength(1);
  });

  it("close() waits for jobs already running (graceful shutdown) — nothing is lost", async () => {
    const worker = startAuditWorker();
    const jobs = await runForTenant(tenantId, () =>
      auditQueue.addBulk(Array.from({ length: 10 }, () => ({ name: "audit-event", data: event() }))),
    );
    await eventually(async () => expect(await worker.isRunning()).toBe(true));
    await worker.close();
    // whatever was picked up finished; the rest is still waiting for the next worker
    const states = await Promise.all(jobs.map((j) => j.getState()));
    expect(states.every((s) => ["completed", "waiting", "prioritized"].includes(s))).toBe(true);
    expect(await rows()).toHaveLength(states.filter((s) => s === "completed").length);
    env.track(startAuditWorker());
    for (const job of jobs) await waitForJob(auditQueue, job.id);
    expect(await rows()).toHaveLength(10);
  });
});
