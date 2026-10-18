const nock = require("nock");
const { useIntegrationApp } = require("../setup/integration");
const { api, expectErrorEnvelope } = require("../helpers/api");
const {
  tokenFor,
  expiredTokenFor,
  wrongSignatureTokenFor,
  refreshSecretTokenFor,
  unsignedTokenFor,
  MALFORMED_TOKENS,
  createUserIn,
} = require("../helpers/auth");
const { tenantFactory } = require("../factories");
const { routeInventory, concretePath } = require("../helpers/routeInventory");
const { runForTenant } = require("../../src/tenancy/context");
const User = require("../../src/models/user.model");
const { KNOWN } = require("./knownFailures");

/**
 * Cross-cutting checks run against EVERY route in the inventory (categories C,
 * D, B/G, M of the Phase 1 matrix). The route list is parsed from src/routes at
 * test time, so a new route is covered the day it is added.
 *
 * A case listed in ./knownFailures.js is a confirmed bug (BUGS_FOUND.md): it is
 * kept and run with test.failing, so it starts passing — and must be moved out
 * of the list — the moment the bug is fixed.
 */
const routes = routeInventory();

// The Pathao city/zone/area lookups call the courier API for every request, so
// their status depends on the upstream answer; tests/integration/courier.test.js
// covers them with the upstream mocked (BUG-004).
const UPSTREAM_LOOKUPS = /\/courier\/(cities|zone|areas)/;
const label = (r) => `${r.method} ${r.fullPath}`;
const caseTest = (key) => (KNOWN[key] ? test.failing : test);
const caseName = (key, name) => (KNOWN[key] ? `${name} [${KNOWN[key]}]` : name);

describe("route matrix", () => {
  const ctx = useIntegrationApp({ clearAfterEach: false });
  const fx = {};

  beforeAll(async () => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);

    fx.tenant = await tenantFactory.create({ slug: "matrix-shop" });
    fx.other = await tenantFactory.create({ slug: "matrix-other" });
    fx.owner = await createUserIn(fx.tenant, { owner: true, raw: true });
    fx.noPerms = await createUserIn(fx.tenant, { raw: true });
    fx.shopper = await createUserIn(fx.tenant, { shopper: true, raw: true });
    fx.inactive = await createUserIn(fx.tenant, { owner: true, raw: true, isActive: false });
    fx.blocked = await createUserIn(fx.tenant, { owner: true, raw: true, isBlocked: true });
    fx.revoked = await createUserIn(fx.tenant, { owner: true, raw: true });
    fx.revokedToken = tokenFor(fx.revoked);
    await runForTenant(fx.tenant._id, () => User.updateOne({ _id: fx.revoked._id }, { $inc: { tokenVersion: 1 } }));
    fx.deleted = await createUserIn(fx.tenant, { owner: true, raw: true });
    fx.deletedToken = tokenFor(fx.deleted);
    await runForTenant(fx.tenant._id, () => User.deleteOne({ _id: fx.deleted._id }));
    fx.foreignOwner = await createUserIn(fx.other, { owner: true, raw: true });
    fx.permUsers = new Map();
  });

  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  const userWith = async ([module, action]) => {
    const key = `${module}:${action}`;
    if (!fx.permUsers.has(key)) {
      fx.permUsers.set(key, await createUserIn(fx.tenant, { raw: true, grants: { [module]: [action] } }));
    }
    return fx.permUsers.get(key);
  };

  const call = (route, { token, tenant = "matrix-shop", param, body = {} } = {}) =>
    api(ctx.server, { token, tenant }).request(route.method, concretePath(route, param)).send(body);

  // ---------------------------------------------------------------- C: authentication
  describe("C. staff routes reject every invalid session with 401", () => {
    const staff = routes.filter((r) => r.auth === "staff");

    it.each(staff.map((r) => [label(r), r]))("%s", async (_name, route) => {
      const sessions = {
        "no token": undefined,
        ...Object.fromEntries(MALFORMED_TOKENS.map((t) => [`malformed "${t}"`, t])),
        expired: expiredTokenFor(fx.owner),
        "wrong signature": wrongSignatureTokenFor(fx.owner),
        "alg none": unsignedTokenFor(fx.owner),
        "signed with the refresh secret": refreshSecretTokenFor(fx.owner),
        "shopper audience": tokenFor(fx.shopper),
        "deactivated user": tokenFor(fx.inactive),
        "blocked user": tokenFor(fx.blocked),
        "revoked token version": fx.revokedToken,
        "deleted user": fx.deletedToken,
        "another store's session": tokenFor(fx.foreignOwner),
      };
      for (const [name, token] of Object.entries(sessions)) {
        const res = await call(route, { token });
        if (res.status !== 401) throw new Error(`${name}: expected 401, got ${res.status} ${JSON.stringify(res.body)}`);
        expectErrorEnvelope(res.body, 401);
      }
    });
  });

  describe("C. shopper routes reject staff, forged and missing sessions", () => {
    const shopperRoutes = routes.filter((r) => r.auth === "shopper");
    it.each(shopperRoutes.map((r) => [label(r), r]))("%s", async (_name, route) => {
      for (const token of [undefined, tokenFor(fx.owner), wrongSignatureTokenFor(fx.shopper), expiredTokenFor(fx.shopper)]) {
        const res = await call(route, { token });
        expect(res.status).toBe(401);
      }
    });
  });

  describe("C. platform routes reject store sessions", () => {
    const platformRoutes = routes.filter((r) => r.auth === "platform");
    it.each(platformRoutes.map((r) => [label(r), r]))("%s", async (_name, route) => {
      for (const token of [undefined, tokenFor(fx.owner), "not-a-jwt"]) {
        const res = await call(route, { token, tenant: undefined });
        expect(res.status).toBe(401);
        expectErrorEnvelope(res.body, 401);
      }
    });
  });

  // ---------------------------------------------------------------- D: authorization
  describe("D. permission-guarded routes answer 403 to a staff member without the permission", () => {
    const guarded = routes.filter((r) => r.auth === "staff" && r.permissionGuarded);
    it.each(guarded.map((r) => [label(r), r]))("%s", async (_name, route) => {
      const res = await call(route, { token: tokenFor(fx.noPerms) });
      expect(res.status).toBe(403);
      expectErrorEnvelope(res.body, 403);

      // Holding the right module with the wrong action is not enough either
      if (route.permission) {
        const [module, action] = route.permission;
        const wrongAction = action === "view" ? "delete" : "view";
        const res2 = await call(route, { token: tokenFor(await userWith([module, wrongAction])) });
        const anyOf = route.chain.some((m) => m.startsWith("authorizeAny"));
        if (!anyOf) expect(res2.status).toBe(403);
      }
    });
  });

  describe("D. the permission named on each route is the one that opens it", () => {
    const guarded = routes.filter((r) => r.auth === "staff" && r.permission && !r.platformManaged);
    it.each(guarded.map((r) => [label(r), r]))("%s", async (_name, route) => {
      const user = await userWith(route.permission);
      const res = await call(route, { token: tokenFor(user) });
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe("D. store permissions cannot change the platform-managed catalogue, even for the owner", () => {
    const managed = routes.filter((r) => r.platformManaged);
    it.each(managed.map((r) => [label(r), r]))("%s", async (_name, route) => {
      const res = await call(route, { token: tokenFor(fx.owner) });
      expect(res.status).toBe(403);
    });
  });

  // ---------------------------------------------------------------- B/G: malformed ids
  describe("B/G. a malformed or unknown id is a client error, never a 500", () => {
    const withParams = routes.filter(
      (r) => r.auth === "staff" && /:\w+/.test(r.fullPath) && !r.platformManaged && !UPSTREAM_LOOKUPS.test(r.fullPath),
    );
    for (const route of withParams) {
      for (const [kind, param] of [["malformed id", "not-an-id"], ["unknown ObjectId", "0123456789abcdef01234567"]]) {
        const key = `${label(route)}|${kind}`;
        caseTest(key)(caseName(key, `${label(route)} with a ${kind}`), async () => {
          const res = await call(route, { token: tokenFor(fx.owner), param });
          expect(res.status).toBeLessThan(500);
          expect(res.status).toBeGreaterThanOrEqual(200);
          if (res.status >= 400) expectErrorEnvelope(res.body);
        });
      }
    }
  });

  describe("B. an empty request body is a client error, never a 500", () => {
    const writes = routes.filter((r) => r.auth === "staff" && ["POST", "PUT", "PATCH"].includes(r.method) && !r.platformManaged);
    for (const route of writes) {
      const key = `${label(route)}|empty body`;
      caseTest(key)(caseName(key, `${label(route)} with {}`), async () => {
        const res = await call(route, { token: tokenFor(fx.owner), body: {} });
        expect(res.status).toBeLessThan(500);
      });
    }
  });

  // ---------------------------------------------------------------- tenancy
  describe("strict tenancy: a public request that names no store is refused cleanly", () => {
    const open = routes.filter((r) => ["public", "optional", "guestOrAuth"].includes(r.auth) && !r.fullPath.includes("/platform/"));
    for (const route of open) {
      const key = `${label(route)}|no store`;
      caseTest(key)(caseName(key, label(route)), async () => {
        const res = await call(route, { tenant: undefined });
        // forgot-password answers 503 SMS_NOT_CONFIGURED on purpose when it cannot send a code
        if (res.status === 503) expect(res.body.code).toBe("SMS_NOT_CONFIGURED");
        else expect(res.status).toBeLessThan(500);
        if (res.status >= 400) expectErrorEnvelope(res.body);
      });
    }
  });

  describe("strict tenancy: a request naming an unknown store gets 404", () => {
    const open = routes.filter((r) => r.auth === "public" && r.method === "GET");
    it.each(open.map((r) => [label(r), r]))("%s", async (_name, route) => {
      const res = await call(route, { tenant: "no-such-store" });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("TENANT_NOT_FOUND");
    });
  });
});
