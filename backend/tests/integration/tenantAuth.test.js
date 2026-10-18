const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { loadApp, createTenantWithStaff, ensurePermission, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant, runAsPlatform } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const Tenant = require("../../src/models/platform/tenant.model");
const User = require("../../src/models/user.model");
const Role = require("../../src/models/role.model");
const service = require("../../src/settings/settings.service");

describe("tenant-aware staff auth", () => {
  let app;
  let pizza;
  let burger;
  const envBackup = { ...process.env };

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  beforeEach(async () => {
    process.env = { ...envBackup, ...STAFF_ENV };
    setSettingsEnv();
    delete process.env.TENANCY_MODE;
    invalidateTenantCache();
    service.clearSettingsCache();
    // Same email in both stores, different passwords
    pizza = await createTenantWithStaff({ slug: "pizzashop", password: "Pizza-Pass1" });
    burger = await createTenantWithStaff({ slug: "burgerhub", password: "Burger-Pass1" });
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const login = (body) => request(app.server).post("/api/v1/auth/login").send(body);
  const decode = (token) => jwt.verify(token, STAFF_ENV.ACCESS_TOKEN_SECRET);
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  describe("login", () => {
    it("signs into the workspace's own account and puts the tenant in the token", async () => {
      const res = await login({ workspace: "pizzashop", email: "staff@shop.test", password: "Pizza-Pass1" }).expect(200);

      const claims = decode(res.body.data.accessToken);
      expect(claims).toMatchObject({ sub: pizza.user._id.toString(), tid: pizza.tenant._id.toString(), tv: 0 });
      expect(claims.email).toBeUndefined();
      expect(res.body.data.tenant).toMatchObject({ slug: "pizzashop", name: "pizzashop" });

      const other = await login({ workspace: "burgerhub", email: "staff@shop.test", password: "Burger-Pass1" }).expect(200);
      expect(decode(other.body.data.accessToken).sub).toBe(burger.user._id.toString());
    });

    it("does not accept another store's password or an unknown workspace", async () => {
      await login({ workspace: "pizzashop", email: "staff@shop.test", password: "Burger-Pass1" }).expect(400);
      const unknown = await login({ workspace: "nope", email: "staff@shop.test", password: "Pizza-Pass1" }).expect(400);
      expect(unknown.body.message).toBe("Invalid credentials");
    });

    it("rejects a suspended store", async () => {
      await Tenant.updateOne({ _id: pizza.tenant._id }, { status: "suspended" });
      const res = await login({ workspace: "pizzashop", email: "staff@shop.test", password: "Pizza-Pass1" }).expect(403);
      expect(res.body.code).toBe("TENANT_SUSPENDED");
    });

    it("does not let a shopper account into the dashboard", async () => {
      await runForTenant(pizza.tenant._id, () => User.create({ name: "Shopper", email: "shopper@shop.test", password: "Shop-Pass1", roles: [] }));
      await login({ workspace: "pizzashop", email: "shopper@shop.test", password: "Shop-Pass1" }).expect(403);
    });

    it("requires a workspace in strict mode: there is no default store", async () => {
      process.env.TENANCY_MODE = "strict";
      const res = await login({ email: "staff@shop.test", password: "Pizza-Pass1" }).expect(400);
      expect(res.body.code).toBe("WORKSPACE_REQUIRED");
    });
  });

  describe("authenticated requests", () => {
    const tokenFor = async (tenantSlug, password) =>
      (await login({ workspace: tenantSlug, email: "staff@shop.test", password })).body.data.accessToken;

    it("runs the request inside the token's tenant", async () => {
      const token = await tokenFor("pizzashop", "Pizza-Pass1");

      // Both stores have a staff@shop.test; only the pizzashop one may answer
      const res = await request(app.server).get("/api/v1/auth/getme").set(bearer(token)).expect(200);
      expect(JSON.stringify(res.body.data)).toContain("pizzashop staff");
      expect(JSON.stringify(res.body.data)).not.toContain("burgerhub staff");
    });

    it("rejects a token presented for a different store", async () => {
      const token = await tokenFor("pizzashop", "Pizza-Pass1");
      await request(app.server).get("/api/v1/auth/getme").set(bearer(token)).set("x-tenant", "burgerhub").expect(401);
    });

    it("signs staff out when their store is suspended", async () => {
      const token = await tokenFor("pizzashop", "Pizza-Pass1");
      await Tenant.updateOne({ _id: pizza.tenant._id }, { status: "suspended" });
      invalidateTenantCache(pizza.tenant._id);

      const res = await request(app.server).get("/api/v1/auth/getme").set(bearer(token)).expect(401);
      expect(res.body.code).toBe("TENANT_SUSPENDED");
    });

    it("rejects tokens issued before the user's token version changed", async () => {
      const token = await tokenFor("pizzashop", "Pizza-Pass1");
      await runAsPlatform(() => User.updateOne({ _id: pizza.user._id }, { $inc: { tokenVersion: 1 } }));
      await request(app.server).get("/api/v1/auth/getme").set(bearer(token)).expect(401);
    });

    it("getme returns tenant, effective permissions, features and owner flag", async () => {
      const permission = await ensurePermission("Product");
      await runForTenant(pizza.tenant._id, async () => {
        const [manager] = await Role.insertMany([{ name: "manager", slug: "manager", permissions: [{ permission: permission._id, actions: ["view", "add"] }] }]);
        await User.updateOne({ _id: pizza.user._id }, { roles: [manager._id], permissions: [{ permission: permission._id, actions: ["edit"] }] });
      });
      const token = await tokenFor("pizzashop", "Pizza-Pass1");

      const res = await request(app.server).get("/api/v1/auth/getme").set(bearer(token)).expect(200);

      expect(res.body.data.email).toBe("staff@shop.test");
      expect(res.body.data.tenant).toMatchObject({ slug: "pizzashop", status: "active" });
      expect(res.body.data.effectivePermissions.product.sort()).toEqual(["add", "edit", "view"]);
      expect(res.body.data.features).toMatchObject({ sms: false, cloudinary: false });
      expect(res.body.data.isOwner).toBe(false);
    });
  });

  describe("refresh", () => {
    const refreshCookie = async (slug, password) => {
      const res = await login({ workspace: slug, email: "staff@shop.test", password });
      return res.headers["set-cookie"].find((c) => c.startsWith("refreshToken=")).split(";")[0];
    };

    it("issues a new tenant-bound access token", async () => {
      const cookie = await refreshCookie("burgerhub", "Burger-Pass1");
      const res = await request(app.server).post("/api/v1/auth/refresh-token").set("Cookie", cookie).expect(200);
      expect(decode(res.body.data.accessToken).tid).toBe(burger.tenant._id.toString());
    });

    // Bumping tokenVersion is how a password reset evicts a stolen session. A
    // refresh that skipped the check would launder the session instead of ending
    // it: the new access token is built from the live document, so it carries the
    // current tokenVersion and sails through authGuard.
    it.each([
      ["a current token", false],
      ["a legacy token with no tid claim", true],
    ])("refuses to refresh %s once tokenVersion moved", async (_label, legacy) => {
      const cookie = await refreshCookie("burgerhub", "Burger-Pass1");

      if (legacy) {
        // Replace the stored refresh token with one issued before multi-tenancy
        const stored = jwt.sign({ id: burger.user._id }, STAFF_ENV.REFRESH_TOKEN_SCCERET, { expiresIn: "7d" });
        await runAsPlatform(() => User.updateOne({ _id: burger.user._id }, { $set: { refreshToken: stored } }));
        await request(app.server)
          .post("/api/v1/auth/refresh-token")
          .set("Cookie", `refreshToken=${stored}`)
          .expect(200); // works until the version moves
        await runAsPlatform(() => User.updateOne({ _id: burger.user._id }, { $inc: { tokenVersion: 1 } }));
        const res = await request(app.server)
          .post("/api/v1/auth/refresh-token")
          .set("Cookie", `refreshToken=${stored}`)
          .expect(401);
        expect(res.body.message).toMatch(/session expired/i);
        return;
      }

      await runAsPlatform(() => User.updateOne({ _id: burger.user._id }, { $inc: { tokenVersion: 1 } }));
      const res = await request(app.server).post("/api/v1/auth/refresh-token").set("Cookie", cookie).expect(401);
      expect(res.body.message).toMatch(/session expired/i);
    });

    // A cross-origin dashboard needs SameSite=none, and a browser drops a
    // SameSite=none cookie that is not also Secure — so the two travel together.
    it.each([
      ["", "development", "lax", false],
      ["", "production", "none", true],
      ["lax", "production", "lax", true],
      ["none", "development", "none", true],
    ])("refresh cookie with AUTH_COOKIE_SAMESITE=%s in %s is SameSite=%s", async (configured, env, sameSite, secure) => {
      const saved = { same: process.env.AUTH_COOKIE_SAMESITE, env: process.env.NODE_ENV };
      if (configured) process.env.AUTH_COOKIE_SAMESITE = configured;
      else delete process.env.AUTH_COOKIE_SAMESITE;
      process.env.NODE_ENV = env;

      try {
        const res = await login({ workspace: "burgerhub", email: "staff@shop.test", password: "Burger-Pass1" });
        const cookie = res.headers["set-cookie"].find((c) => c.startsWith("refreshToken="));
        expect(cookie).toMatch(new RegExp(`SameSite=${sameSite}`, "i"));
        expect(/Secure/i.test(cookie)).toBe(secure);
      } finally {
        if (saved.same) process.env.AUTH_COOKIE_SAMESITE = saved.same; else delete process.env.AUTH_COOKIE_SAMESITE;
        process.env.NODE_ENV = saved.env;
      }
    });

    it("refuses to refresh into a suspended store", async () => {
      const cookie = await refreshCookie("burgerhub", "Burger-Pass1");
      await Tenant.updateOne({ _id: burger.tenant._id }, { status: "suspended" });
      invalidateTenantCache(burger.tenant._id);

      const res = await request(app.server).post("/api/v1/auth/refresh-token").set("Cookie", cookie).expect(401);
      expect(res.body.code).toBe("TENANT_SUSPENDED");
    });
  });

  describe("legacy tokens issued before multi-tenancy", () => {
    const legacyToken = (user) =>
      jwt.sign({ id: user._id, email: user.email, name: user.name, phone: user.phone }, STAFF_ENV.ACCESS_TOKEN_SECRET);

    it("work in the user's tenant during the grace period", async () => {
      process.env.LEGACY_TOKEN_GRACE_UNTIL = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app.server).get("/api/v1/auth/getme").set(bearer(legacyToken(pizza.user))).expect(200);
      expect(res.body.data.tenant.slug).toBe("pizzashop");
    });

    it("are rejected once the grace period is over", async () => {
      process.env.LEGACY_TOKEN_GRACE_UNTIL = new Date(Date.now() - 1000).toISOString();
      await request(app.server).get("/api/v1/auth/getme").set(bearer(legacyToken(pizza.user))).expect(401);
    });

    // A session with no tenant would read and write across every store, so it is
    // rejected in both modes, grace period or not.
    it("are rejected for users without a tenant, in any mode", async () => {
      const legacyUser = await runAsPlatform(async () => {
        await User.collection.insertOne({ name: "Legacy", email: "legacy@shop.test", password: "x", roles: [], permissions: [], isActive: true, isBlocked: false });
        return User.collection.findOne({ email: "legacy@shop.test" });
      });
      process.env.LEGACY_TOKEN_GRACE_UNTIL = new Date(Date.now() + 86400000).toISOString();
      await request(app.server).get("/api/v1/auth/getme").set(bearer(legacyToken(legacyUser))).expect(401);

      process.env.TENANCY_MODE = "strict";
      await request(app.server).get("/api/v1/auth/getme").set(bearer(legacyToken(legacyUser))).expect(401);
    });
  });
});
