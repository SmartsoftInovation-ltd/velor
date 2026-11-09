const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp } = require("../helpers/platform");
const { setSettingsEnv } = require("../helpers/settings");
const { PNG, tempUploadTracker, enableCloudinary } = require("../helpers/uploads");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const Tenant = require("../../src/models/platform/tenant.model");
const StoreInformation = require("../../src/models/storeInformation.model");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");
const { runForTenant } = require("../../src/tenancy/context");
const service = require("../../src/settings/settings.service");
const { closeAppRedis } = require("../helpers/redis");

/**
 * The Platform Console replaces a seller's logo: the image on that seller's
 * Store Information record, uploaded in their tenant scope.
 */
describe("platform tenant logo API", () => {
  const uploads = tempUploadTracker();
  let app;
  let tenant;
  let adminAuth;
  let supportAuth;

  beforeAll(async () => {
    setPlatformEnv();
    setSettingsEnv();
    await connectTestDb();
    app = buildPlatformApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(async () => {
    uploads.snapshot();
    service.clearSettingsCache();
    tenant = await Tenant.create({ name: "Pizza Shop", slug: "pizzashop", status: "active" });
    adminAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "superadmin" }))}` };
    supportAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "support" }))}` };
  });
  afterEach(async () => {
    uploads.cleanup();
    await clearTestDb();
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    // The upload queues a job, which opens the app's Redis clients
    await require("../../src/queues/image.queue").imageQueue.close();
    await closeAppRedis();
    await disconnectTestDb();
  });

  const url = () => `/api/v1/platform/tenants/${tenant._id}/logo`;
  const createStore = () =>
    runForTenant(tenant._id, () =>
      StoreInformation.create({
        storeName: "Pizza Shop",
        adress: "Dhaka",
        phone: "01700000000",
        image: { url: "https://res.cloudinary.com/x/old.png", publicId: "old", status: "uploaded" },
      }),
    );
  const upload = (auth = adminAuth) =>
    request(app).put(url()).set(auth).attach("image", PNG, "logo.png");

  it("reads the seller's current logo", async () => {
    await createStore();
    const res = await request(app).get(url()).set(supportAuth).expect(200);
    expect(res.body.data).toMatchObject({ url: "https://res.cloudinary.com/x/old.png", status: "uploaded", hasStoreInformation: true });
  });

  it("reports a seller with no Store Information", async () => {
    const res = await request(app).get(url()).set(supportAuth).expect(200);
    expect(res.body.data).toMatchObject({ url: "", hasStoreInformation: false });
  });

  it("queues the new logo for the seller and keeps the old one until it uploads", async () => {
    const store = await createStore();
    await enableCloudinary(tenant);

    await upload().expect(200);

    const saved = await runForTenant(tenant._id, () => StoreInformation.findById(store._id).lean());
    expect(saved.image).toMatchObject({ status: "pending", url: "https://res.cloudinary.com/x/old.png" });
    expect(saved.image.localPath).toMatch(/logo-/);

    const { imageQueue } = require("../../src/queues/image.queue");
    const jobs = await imageQueue.getJobs(["waiting"]);
    const mine = jobs.filter((j) => String(j.data.documentId) === store._id.toString());
    expect(mine.map((j) => j.name)).toEqual(["update-storeinformation-image"]);
    expect(mine[0].data).toMatchObject({ tenantId: tenant._id.toString(), oldPublicId: "old" });
    await Promise.all(mine.map((j) => j.remove()));

    expect(await PlatformAuditLog.countDocuments({ action: "TENANT_LOGO_UPDATED", tenantId: tenant._id })).toBe(1);
  });

  it("only a superadmin can change it", async () => {
    await createStore();
    await upload(supportAuth).expect(403);
  });

  it("409 when the seller has no Store Information, and the file is removed", async () => {
    await enableCloudinary(tenant);
    await upload().expect(409);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(uploads.created()).toHaveLength(0);
  });

  it("422 when the seller has no image storage configured", async () => {
    await createStore();
    const res = await upload().expect(422);
    expect(res.body.code ?? res.body.message).toBeTruthy();
  });

  it("400 without a file, 404 for an unknown seller", async () => {
    await createStore();
    await request(app).put(url()).set(adminAuth).expect(400);
    await request(app).put(`/api/v1/platform/tenants/${"a".repeat(24)}/logo`).set(adminAuth).attach("image", PNG, "logo.png").expect(404);
  });
});
