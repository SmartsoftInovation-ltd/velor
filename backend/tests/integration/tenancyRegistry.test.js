const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { tenantPlugin } = require("../../src/tenancy/tenantPlugin");
const { GLOBAL_MODELS } = require("../../src/tenancy/registry");

const MODELS_DIR = path.join(__dirname, "../../src/models");

const modelFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return modelFiles(full);
    return entry.name.endsWith(".js") ? [full] : [];
  });

describe("tenancy registry", () => {
  beforeAll(() => {
    modelFiles(MODELS_DIR).forEach((file) => require(file));
  });

  const appModels = () =>
    mongoose.modelNames().filter((name) => !name.startsWith("Tp") && name !== "HarnessThing");

  it("every model is tenant-scoped or explicitly global", () => {
    const unregistered = appModels().filter((name) => {
      const { schema } = mongoose.model(name);
      const scoped = schema.plugins.some((p) => p.fn === tenantPlugin) && schema.path("tenantId");
      return !scoped && !GLOBAL_MODELS.includes(name);
    });

    expect(unregistered).toEqual([]);
  });

  it("every unique index on a tenant-scoped model is unique per tenant", () => {
    const offenders = appModels()
      .filter((name) => !GLOBAL_MODELS.includes(name))
      .flatMap((name) =>
        mongoose.model(name).schema.indexes()
          .filter(([fields, options]) => options.unique && Object.keys(fields)[0] !== "tenantId")
          .map(([fields]) => `${name}(${Object.keys(fields).join(",")})`),
      );
    expect(offenders).toEqual([]);
  });

  it("global models do not carry the tenant plugin", () => {
    for (const name of GLOBAL_MODELS) {
      const { schema } = mongoose.model(name);
      expect(schema.plugins.some((p) => p.fn === tenantPlugin)).toBe(false);
    }
  });

  it("the global list only names models that exist", () => {
    for (const name of GLOBAL_MODELS) expect(appModels()).toContain(name);
  });
});
