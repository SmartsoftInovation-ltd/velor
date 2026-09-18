jest.mock("cloudinary", () => {
  const v2 = {
    config: jest.fn(),
    uploader: { upload: jest.fn() },
    url: jest.fn(),
    api: { delete_resources: jest.fn() },
  };
  return { v2 };
});
jest.mock("../../src/integrations/config", () => ({ getCloudinaryConfig: jest.fn() }));

const fs = require("fs");
const os = require("os");
const path = require("path");
const cloudinary = require("cloudinary").v2;
const { getCloudinaryConfig } = require("../../src/integrations/config");
const { cloudinaryFileUpload, deleteCloudinaryFile, uploadBarcodeToCloudinary } = require("../../src/helpers/cloudinary");

const creds = { cloud_name: "pizza-cdn", api_key: "222", api_secret: "pizza-secret" };

describe("helpers/cloudinary", () => {
  let file;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    getCloudinaryConfig.mockResolvedValue({ ...creds });
    cloudinary.uploader.upload.mockResolvedValue({ public_id: "pizza/abc" });
    cloudinary.url.mockReturnValue("https://res.cloudinary.com/pizza-cdn/abc");
    cloudinary.api.delete_resources.mockResolvedValue({ deleted: { "pizza/abc": "deleted" } });
    file = path.join(os.tmpdir(), `upload-${Date.now()}.jpg`);
    fs.writeFileSync(file, "x");
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  it("never configures credentials globally", () => {
    expect(cloudinary.config).not.toHaveBeenCalledWith(expect.objectContaining({ api_secret: expect.anything() }));
  });

  // Uploads land in each tenant's own Cloudinary account, so there is no folder
  // to separate them with — the account is the boundary.
  it("uploads with the tenant's credentials, and reports the cloud name", async () => {
    const result = await cloudinaryFileUpload(file, { deleteAfter: false });

    expect(cloudinary.uploader.upload).toHaveBeenCalledWith(file, { ...creds, resource_type: "auto" });
    expect(cloudinary.url).toHaveBeenCalledWith("pizza/abc", expect.objectContaining({ cloud_name: "pizza-cdn" }));
    expect(result).toMatchObject({ cloudName: "pizza-cdn", optimizeUrl: "https://res.cloudinary.com/pizza-cdn/abc" });
  });

  it("propagates CLOUDINARY_NOT_CONFIGURED instead of returning null", async () => {
    getCloudinaryConfig.mockRejectedValue(Object.assign(new Error("not configured"), { code: "CLOUDINARY_NOT_CONFIGURED" }));
    await expect(cloudinaryFileUpload(file, { deleteAfter: false })).rejects.toMatchObject({ code: "CLOUDINARY_NOT_CONFIGURED" });
  });

  it("deletes with the tenant's credentials", async () => {
    await deleteCloudinaryFile("pizza/abc", "pizza-cdn");
    expect(cloudinary.api.delete_resources).toHaveBeenCalledWith(["pizza/abc"], expect.objectContaining({ ...creds, type: "upload" }));
  });

  it("skips deleting an asset that belongs to a different Cloudinary account", async () => {
    await expect(deleteCloudinaryFile("old/abc", "old-cloud")).resolves.toMatchObject({ skipped: true });
    expect(cloudinary.api.delete_resources).not.toHaveBeenCalled();
  });

  it("uploads barcodes with the tenant's credentials", async () => {
    await uploadBarcodeToCloudinary("data:image/png;base64,AAA");
    expect(cloudinary.uploader.upload).toHaveBeenCalledWith("data:image/png;base64,AAA", expect.objectContaining(creds));
  });
});
