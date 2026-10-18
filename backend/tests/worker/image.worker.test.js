const fs = require("fs");
const os = require("os");
const path = require("path");
const nock = require("nock");
const mongoose = require("mongoose");
const { useWorkerEnv } = require("../helpers/workerEnv");
const { waitForJob } = require("../helpers/wait");
const { testRedis } = require("../helpers/redis");
const { PNG } = require("../helpers/uploads");
const { runForTenant } = require("../../src/tenancy/context");
const { imageQueue } = require("../../src/queues/image.queue");
const { startImageWorker } = require("../../src/workers/image.worker");
const Category = require("../../src/models/category.model");
const settings = require("../../src/settings/settings.service");

const CLOUDINARY = "https://api.cloudinary.com";

describe("image worker (queue: image-upload)", () => {
  const env = useWorkerEnv();
  const tenantId = new mongoose.Types.ObjectId();
  const inTenant = (fn) => runForTenant(tenantId, fn);
  let dir;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);
  });
  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-worker-"));
    await settings.updateSection(tenantId, "cloudinary", { enabled: true, cloudName: "test-cloud", apiKey: "123456789", apiSecret: "dummy-cloudinary-secret" });
    settings.clearSettingsCache();
  });
  afterEach(() => {
    nock.cleanAll();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const tempImage = () => {
    const file = path.join(dir, `img-${Math.random().toString(36).slice(2)}.png`);
    fs.writeFileSync(file, PNG);
    return file;
  };
  const category = () => inTenant(() => Category.create({ name: `Cat ${Math.random()}`, image: { status: "pending" } }));
  const upload = (doc, localPath, opts) =>
    inTenant(() => imageQueue.add("create-category-image", { modelName: "category", documentId: doc._id.toString(), localPath }, opts));
  const reload = (doc) => inTenant(() => Category.findById(doc._id).lean());

  it("is configured with 5 attempts and exponential backoff", () => {
    expect(imageQueue.defaultJobOptions).toMatchObject({ attempts: 5, backoff: { type: "exponential", delay: 2000 } });
  });

  it("uploads to the tenant's Cloudinary account, stores the URL, deletes the temp file and bumps the cache", async () => {
    const scope = nock(CLOUDINARY)
      .post("/v1_1/test-cloud/auto/upload")
      .reply(200, { public_id: "shop/cat123", secure_url: "https://res.cloudinary.com/test-cloud/image/upload/shop/cat123.png" });
    env.track(startImageWorker());
    const doc = await category();
    const file = tempImage();
    const job = await upload(doc, file);
    const { state } = await waitForJob(imageQueue, job.id);
    expect(state).toBe("completed");
    expect(scope.isDone()).toBe(true);

    const stored = await reload(doc);
    expect(stored.image).toMatchObject({ status: "uploaded", publicId: "shop/cat123", cloudName: "test-cloud", localPath: "", lastError: "" });
    expect(stored.image.url).toContain("res.cloudinary.com/test-cloud");
    expect(fs.existsSync(file)).toBe(false);
    expect(await testRedis().get(`t:${tenantId}:category:v`)).toBeTruthy();
  });

  it("a Cloudinary failure marks the image failed, keeps the file for the retry, and retries", async () => {
    nock(CLOUDINARY).post("/v1_1/test-cloud/auto/upload").times(2).reply(500, { error: { message: "boom" } });
    env.track(startImageWorker());
    const doc = await category();
    const file = tempImage();
    const job = await upload(doc, file, { attempts: 2, backoff: { type: "fixed", delay: 10 } });
    const { state, job: done } = await waitForJob(imageQueue, job.id);
    expect(state).toBe("failed");
    expect(done.attemptsMade).toBe(2);
    const stored = await reload(doc);
    expect(stored.image.status).toBe("failed");
    expect(stored.image.lastError).toMatch(/upload failed|null/i);
    expect(stored.image.tries).toBe(2);
    expect(fs.existsSync(file)).toBe(true); // fewer than 3 attempts made: kept for a manual retry
  });

  it("succeeds on a retry after a transient failure", async () => {
    nock(CLOUDINARY).post("/v1_1/test-cloud/auto/upload").reply(503, { error: { message: "temporarily unavailable" } });
    nock(CLOUDINARY).post("/v1_1/test-cloud/auto/upload").reply(200, { public_id: "shop/ok" });
    env.track(startImageWorker());
    const doc = await category();
    const job = await upload(doc, tempImage(), { attempts: 3, backoff: { type: "fixed", delay: 10 } });
    const { state } = await waitForJob(imageQueue, job.id);
    expect(state).toBe("completed");
    expect((await reload(doc)).image).toMatchObject({ status: "uploaded", publicId: "shop/ok", tries: 2 });
  });

  it("an unknown model fails the job without touching anything", async () => {
    env.track(startImageWorker());
    const job = await inTenant(() => imageQueue.add("x", { modelName: "spaceship", documentId: new mongoose.Types.ObjectId().toString(), localPath: "/nope" }, { attempts: 1 }));
    const { state, job: done } = await waitForJob(imageQueue, job.id);
    expect(state).toBe("failed");
    expect(done.failedReason).toMatch(/not found in worker registry/);
  });

  it("delete jobs remove the asset from the tenant's own account only", async () => {
    const scope = nock(CLOUDINARY).delete(/\/v1_1\/test-cloud\/resources\/image\/upload/).query(true).reply(200, { deleted: { "shop/a": "deleted" } });
    env.track(startImageWorker());
    const own = await inTenant(() => imageQueue.add("delete-cloudinary-image", { publicId: "shop/a", cloudName: "test-cloud" }));
    const { state } = await waitForJob(imageQueue, own.id);
    expect(state).toBe("completed");
    expect(scope.isDone()).toBe(true);

    // An asset from a previous Cloudinary account: skipped, never sent to this one
    const foreign = await inTenant(() => imageQueue.add("delete-cloudinary-image", { publicId: "old/b", cloudName: "previous-cloud" }));
    const done = await waitForJob(imageQueue, foreign.id);
    expect(done.state).toBe("completed");
  });

  it("never updates another tenant's document with the same id", async () => {
    nock(CLOUDINARY).post("/v1_1/test-cloud/auto/upload").reply(200, { public_id: "shop/x" });
    env.track(startImageWorker());
    const otherTenant = new mongoose.Types.ObjectId();
    const theirs = await runForTenant(otherTenant, () => Category.create({ name: "Theirs", image: { status: "pending" } }));
    // A job from our tenant naming their document's id
    const job = await inTenant(() => imageQueue.add("create-category-image", { modelName: "category", documentId: theirs._id.toString(), localPath: tempImage() }));
    await waitForJob(imageQueue, job.id);
    const stored = await runForTenant(otherTenant, () => Category.findById(theirs._id).lean());
    expect(stored.image.status).toBe("pending");
  });
});
