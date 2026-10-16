const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { runForTenant, getTenantId } = require("../../src/tenancy/context");
const { globalErrorHandeler } = require("../../src/lib/GlobalErrorHandeler");
const { singleFileUpload, multipleFileUploadWithFields, anyFileUpload } = require("../../src/middleware/multer.middleware");
const service = require("../../src/settings/settings.service");

const T = new mongoose.Types.ObjectId();
const TEMP = path.join(__dirname, "../../public/temp");

describe("upload guard", () => {
  let app;
  const before = new Set();

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    service.setSettingsPublisher(async () => {});
    fs.readdirSync(TEMP).forEach((f) => before.add(f));

    app = express();
    app.use((req, res, next) => (req.headers["x-test-tenant"] ? runForTenant(req.headers["x-test-tenant"], () => next()) : next()));
    app.post("/single", singleFileUpload("image"), (req, res) => res.json({ ok: true }));
    app.post("/fields", multipleFileUploadWithFields([{ name: "thumbnail", maxCount: 1 }]), (req, res) => res.json({ ok: true }));
    app.post("/any", anyFileUpload(), (req, res) => res.json({ ok: true }));
    app.post("/none", singleFileUpload("image"), (req, res) => res.json({ ok: true }));
    app.post("/tenant", singleFileUpload("image"), (req, res) => res.json({ tenantId: String(getTenantId()) }));
    app.use(globalErrorHandeler);
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  beforeEach(() => service.clearSettingsCache());
  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const newTempFiles = () => fs.readdirSync(TEMP).filter((f) => !before.has(f));
  const png = Buffer.from("89504e47", "hex");

  it.each(["/single", "/fields", "/any"])("%s rejects files with 422 when the tenant has no Cloudinary and removes the temp file", async (route) => {
    const field = route === "/fields" ? "thumbnail" : "image";
    const res = await request(app).post(route).set("x-test-tenant", T.toString()).attach(field, png, "photo.png").expect(422);

    expect(res.body.code).toBe("CLOUDINARY_NOT_CONFIGURED");
    expect(newTempFiles()).toEqual([]);
  });

  it("lets uploads through once Cloudinary is configured", async () => {
    await service.updateSection(T, "cloudinary", { enabled: true, cloudName: "pizza-cdn", apiKey: "1", apiSecret: "s" });
    await request(app).post("/single").set("x-test-tenant", T.toString()).attach("image", png, "photo.png").expect(200);
    newTempFiles().forEach((f) => fs.unlinkSync(path.join(TEMP, f)));
  });

  it("keeps the request's tenant context after parsing a multipart body", async () => {
    const res = await request(app).post("/tenant").set("x-test-tenant", T.toString()).field("name", "Pizza").expect(200);
    expect(res.body.tenantId).toBe(T.toString());
  });

  it("does not block requests without files or without a tenant context", async () => {
    await request(app).post("/none").set("x-test-tenant", T.toString()).expect(200);
    await request(app).post("/single").attach("image", png, "photo.png").expect(200);
    newTempFiles().forEach((f) => fs.unlinkSync(path.join(TEMP, f)));
  });
});
