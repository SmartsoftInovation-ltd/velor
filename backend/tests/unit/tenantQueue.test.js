const mongoose = require("mongoose");
const { runForTenant, getTenantId } = require("../../src/tenancy/context");
const { tenantAwareQueue, tenantJob } = require("../../src/tenancy/queue");

const T = new mongoose.Types.ObjectId();

describe("tenancy/queue", () => {
  const envBackup = { ...process.env };
  afterEach(() => {
    process.env = { ...envBackup };
  });

  const fakeQueue = () => ({
    add: jest.fn(async (name, data, opts) => ({ name, data, opts })),
    addBulk: jest.fn(async (jobs) => jobs),
  });

  it("stamps the current tenant on added jobs", async () => {
    const queue = tenantAwareQueue(fakeQueue());

    const job = await runForTenant(T, () => queue.add("upload", { documentId: "d1" }, { delay: 1 }));
    const [bulk] = await runForTenant(T, () => queue.addBulk([{ name: "x", data: { a: 1 } }]));

    expect(job).toEqual({ name: "upload", data: { documentId: "d1", tenantId: T.toString() }, opts: { delay: 1 } });
    expect(bulk.data).toEqual({ a: 1, tenantId: T.toString() });
  });

  it("leaves jobs without tenant outside a tenant context", async () => {
    const queue = tenantAwareQueue(fakeQueue());
    const job = await queue.add("upload", { documentId: "d1" });
    expect(job.data).toEqual({ documentId: "d1" });
  });

  it("runs a processor inside the job's tenant", async () => {
    const processor = tenantJob(async () => getTenantId()?.toString());
    await expect(processor({ data: { tenantId: T.toString() } })).resolves.toBe(T.toString());
  });

  it("runs legacy jobs without tenant in shadow mode and rejects them in strict mode", async () => {
    const processor = tenantJob(async () => "ran");
    await expect(processor({ data: {} })).resolves.toBe("ran");

    process.env.TENANCY_MODE = "strict";
    await expect(processor({ id: "7", data: {} })).rejects.toThrow(/tenantId/);
  });
});
