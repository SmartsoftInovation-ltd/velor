const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp, PASSWORD, PLATFORM_ENV } = require("../helpers/platform");
const PlatformUser = require("../../src/models/platform/platformUser.model");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");

const BASE = "/api/v1/platform/auth";

const refreshCookie = (res) =>
  (res.headers["set-cookie"] || []).find((c) => c.startsWith("platformRefreshToken="));

describe("platform auth API", () => {
  let app;

  beforeAll(async () => {
    setPlatformEnv();
    await connectTestDb();
    app = buildPlatformApp();
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  describe("POST /login", () => {
    it("returns a platform access token and sets an httpOnly refresh cookie", async () => {
      const user = await createPlatformUser();

      const res = await request(app).post(`${BASE}/login`).send({ email: user.email.toUpperCase(), password: PASSWORD }).expect(200);

      const payload = jwt.verify(res.body.data.accessToken, PLATFORM_ENV.PLATFORM_ACCESS_TOKEN_SECRET, { audience: "platform" });
      expect(payload.sub).toBe(user._id.toString());
      expect(payload.tv).toBe(0);
      expect(res.body.data.user).toMatchObject({ email: user.email, role: "superadmin" });
      expect(res.body.data.user.password).toBeUndefined();

      const cookie = refreshCookie(res);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Path=\/api\/v1\/platform\/auth/);

      const stored = await PlatformUser.findById(user._id);
      expect(stored.lastLoginAt).toBeInstanceOf(Date);
      expect(await PlatformAuditLog.countDocuments({ action: "PLATFORM_LOGIN", actor: user._id })).toBe(1);
    });

    it("gives the same answer for an unknown email and a wrong password", async () => {
      const user = await createPlatformUser();

      const unknown = await request(app).post(`${BASE}/login`).send({ email: "nobody@platform.test", password: PASSWORD }).expect(401);
      const wrong = await request(app).post(`${BASE}/login`).send({ email: user.email, password: "wrong-password" }).expect(401);

      expect(unknown.body.message).toBe("Invalid credentials");
      expect(wrong.body.message).toBe("Invalid credentials");
      expect(await PlatformAuditLog.countDocuments({ action: "PLATFORM_LOGIN_FAILED", actor: user._id })).toBe(1);
    });

    it("rejects a deactivated account", async () => {
      const user = await createPlatformUser({ isActive: false });
      await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(403);
    });

    it("validates the body", async () => {
      await request(app).post(`${BASE}/login`).send({ email: "not-an-email" }).expect(400);
    });

    it("fails closed when platform secrets are not configured", async () => {
      const user = await createPlatformUser();
      const saved = process.env.PLATFORM_ACCESS_TOKEN_SECRET;
      delete process.env.PLATFORM_ACCESS_TOKEN_SECRET;
      try {
        await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(500);
      } finally {
        process.env.PLATFORM_ACCESS_TOKEN_SECRET = saved;
      }
    });
  });

  describe("POST /refresh and /logout, GET /me", () => {
    const login = async () => {
      const user = await createPlatformUser();
      const res = await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD });
      return { user, cookie: refreshCookie(res).split(";")[0], accessToken: res.body.data.accessToken };
    };

    it("issues a new access token from the refresh cookie", async () => {
      const { user, cookie } = await login();
      const res = await request(app).post(`${BASE}/refresh`).set("Cookie", cookie).expect(200);
      const payload = jwt.verify(res.body.data.accessToken, PLATFORM_ENV.PLATFORM_ACCESS_TOKEN_SECRET, { audience: "platform" });
      expect(payload.sub).toBe(user._id.toString());
    });

    it("rejects refresh without a cookie or with a staff-signed cookie", async () => {
      await request(app).post(`${BASE}/refresh`).expect(401);
      const forged = jwt.sign({ tv: 0 }, PLATFORM_ENV.REFRESH_TOKEN_SCCERET, { subject: "x" });
      await request(app).post(`${BASE}/refresh`).set("Cookie", `platformRefreshToken=${forged}`).expect(401);
    });

    it("returns the current platform user", async () => {
      const { user, accessToken } = await login();
      const res = await request(app).get(`${BASE}/me`).set("Authorization", `Bearer ${accessToken}`).expect(200);
      expect(res.body.data).toMatchObject({ _id: user._id.toString(), email: user.email });
    });

    it("logout revokes every issued token and clears the cookie", async () => {
      const { cookie, accessToken } = await login();

      const res = await request(app).post(`${BASE}/logout`).set("Cookie", cookie).expect(200);
      expect(refreshCookie(res)).toMatch(/platformRefreshToken=;/);

      await request(app).post(`${BASE}/refresh`).set("Cookie", cookie).expect(401);
      await request(app).get(`${BASE}/me`).set("Authorization", `Bearer ${accessToken}`).expect(401);
    });

    it("logout without a valid cookie still succeeds", async () => {
      await request(app).post(`${BASE}/logout`).expect(200);
    });
  });
});
