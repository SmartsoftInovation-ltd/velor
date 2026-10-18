const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { routeInventory } = require("../helpers/routeInventory");

// docs/openapi.yaml is generated (tests/scripts/generateInventory.js); this
// fails when a route is added or removed without regenerating it.
describe("docs/openapi.yaml", () => {
  const doc = yaml.load(fs.readFileSync(path.join(__dirname, "../../docs/openapi.yaml"), "utf8"));
  const routes = routeInventory();
  const keyOf = (r) => (r.fullPath.replace(/^\/api\/v1/, "") || "/").replace(/:(\w+)/g, "{$1}").replace(/\*/g, "{wildcard}");

  it("is valid OpenAPI 3 with the two shared envelopes", () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(doc.components.schemas.SuccessEnvelope.required).toEqual(["status", "statusCode", "message"]);
    expect(doc.components.schemas.ErrorEnvelope.required).toEqual(["statusCode", "message"]);
  });

  it("documents every route in the code, and nothing else", () => {
    const documented = Object.entries(doc.paths).flatMap(([p, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${p}`));
    const actual = routes.map((r) => `${r.method} ${keyOf(r)}`);
    expect(documented.sort()).toEqual([...new Set(actual)].sort());
  });

  it("records the permission and security of each guarded route", () => {
    for (const r of routes.filter((x) => x.permission)) {
      const op = doc.paths[keyOf(r)][r.method.toLowerCase()];
      expect(op["x-permission"]).toBe(`${r.permission[0]}:${r.permission[1]}`);
      expect(op.security).toEqual([{ staffBearer: [] }]);
    }
  });
});
