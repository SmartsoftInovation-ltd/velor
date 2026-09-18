const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { tenantPlugin } = require("../../src/tenancy/tenantPlugin");
const { tenantModels } = require("../../src/migrations/models");

/**
 * Every `$lookup`/`$unionWith` target must be a tenant-scoped collection.
 *
 * The plugin decides whether to inject a tenant `$match` into a joined pipeline
 * by matching the `from:` string against a registered model's collection name
 * (`isTenantCollection`). That means a join whose `from:` does not resolve —
 * a typo, a wrong plural, a collection whose model was never required — runs
 * **unscoped**, silently pulling every store's rows into one store's report.
 *
 * Nothing about that failure looks wrong: the response keeps its shape, only the
 * numbers are too big. So this test reads the `from:` literals straight out of
 * the controller sources and fails the moment one of them stops resolving.
 */

const SOURCE_DIRS = ["src/controller", "src/service"];
const FROM_LITERAL = /\bfrom:\s*"([a-z0-9_]+)"/gi;

const sourceFiles = (dir, found = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, found);
    else if (entry.name.endsWith(".js")) found.push(full);
  }
  return found;
};

const lookupTargets = () => {
  const targets = new Map(); // collection name -> where it was found
  for (const dir of SOURCE_DIRS) {
    for (const file of sourceFiles(path.join(__dirname, "../..", dir))) {
      const source = fs.readFileSync(file, "utf8");
      for (const [, name] of source.matchAll(FROM_LITERAL)) {
        if (!targets.has(name)) targets.set(name, path.relative(path.join(__dirname, "../.."), file));
      }
    }
  }
  return targets;
};

describe("aggregation joins stay inside the tenant", () => {
  let scopedCollections;
  let targets;

  beforeAll(() => {
    // Loads every model file, so the registry is as warm as it is at runtime
    scopedCollections = new Set(
      tenantModels()
        .filter((Model) => Model.schema.plugins.some((p) => p.fn === tenantPlugin))
        .map((Model) => Model.collection.collectionName),
    );
    targets = lookupTargets();
  });

  it("finds the joins it is meant to be checking", () => {
    // Guards against the regex quietly matching nothing after a refactor
    expect(targets.size).toBeGreaterThan(10);
  });

  it("every $lookup target resolves to a tenant-scoped collection", () => {
    const unscoped = [...targets.entries()]
      .filter(([name]) => !scopedCollections.has(name))
      .map(([name, file]) => `${name} (${file})`);

    expect(unscoped).toEqual([]);
  });

  // The plugin looks the collection up through mongoose's registry, so a model
  // that is never required is indistinguishable from one that does not exist.
  it("resolves every target through the same registry the plugin uses", () => {
    const viaRegistry = new Set(
      mongoose.modelNames().map((name) => mongoose.model(name).collection.collectionName),
    );
    const missing = [...targets.keys()].filter((name) => !viaRegistry.has(name));

    expect(missing).toEqual([]);
  });
});
