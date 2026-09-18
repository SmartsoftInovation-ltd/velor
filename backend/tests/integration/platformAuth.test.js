const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp, PASSWORD, PLATFORM_ENV } = require("../helpers/platform");
const PlatformUser = require("../../src/models/platform/platformUser.model");
const PlatformAuditLog = require("../../src/models/platform/platformAuditLog.model");

// The console's second factor keeps codes in Redis; the stub gives real TTL
// semantics without a server.
jest.mock("../../src/config/redis.config", () => require("../mocks/redisCache"));

// The code goes out through the platform SMS account: capture it instead of texting
const sentMessages = [];
jest.mock("../../src/service/platformSms.service", () => ({
  platformSmsAvailable: () => true,
  sendPlatformSms: jest.fn(async (number, message) => {
    sentMessages.push({ number, message });
    return { response_code: 202 };
  }),
}));

const { cache, __reset: resetRedis } = require("../mocks/redisCache");
const { resetRateLimitCounters } = require("../../src/middleware/rateLimit.middleware");
const { sendPlatformSms } = require("../../src/service/platformSms.service");

const BASE = "/api/v1/platform/auth";

const refreshCookie = (res) =>
  (res.headers["set-cookie"] || []).find((c) => c.startsWith("platformRefreshToken="));

const codeFromSms = () => sentMessages.at(-1).message.match(/\b(\d{6})\b/)[1];

describe("platform auth API", () => {
  let app;

  beforeAll(async () => {
    setPlatformEnv();
    await connectTestDb();
    app = buildPlatformApp();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(async () => {
    await clearTestDb();
    resetRedis();
    // Every test signs in from the same address; without this the sign-in
    // limiter would count the whole suite as one brute-force run.
    resetRateLimitCounters();
    sentMessages.length = 0;
    sendPlatformSms.mockClear();
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  // Password, then the texted code. Used by every test that needs a session.
  const signIn = async (overrides = {}) => {
    const user = await createPlatformUser(overrides);
    const start = await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(200);
    const res = await request(app)
      .post(`${BASE}/verify-otp`)
      .send({ challengeId: start.body.data.challengeId, code: codeFromSms() })
      .expect(200);
    return { user, cookie: refreshCookie(res).split(";")[0], accessToken: res.body.data.accessToken, res };
  };

  describe("POST /login", () => {
    it("texts a code to the operator phone and issues no session", async () => {
      const user = await createPlatformUser();

      const res = await request(app).post(`${BASE}/login`).send({ email: user.email.toUpperCase(), password: PASSWORD }).expect(200);

      expect(res.body.data).toMatchObject({ phone: "01*******62", expiresInSeconds: 300 });
      expect(res.body.data.challengeId).toEqual(expect.any(String));
      // The password alone must not open anything
      expect(res.body.data.accessToken).toBeUndefined();
      expect(refreshCookie(res)).toBeUndefined();

      expect(sendPlatformSms).toHaveBeenCalledTimes(1);
      expect(sentMessages[0].number).toBe(PLATFORM_ENV.PLATFORM_ADMIN_PHONE);
      expect(sentMessages[0].message).toMatch(/\b\d{6}\b/);
      expect(await PlatformAuditLog.countDocuments({ action: "PLATFORM_LOGIN_OTP_SENT", actor: user._id })).toBe(1);
    });

    it("stores only a hash of the code", async () => {
      const user = await createPlatformUser();
      const res = await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(200);

      const stored = await cache.get(`platform:otp:${res.body.data.challengeId}`);
      expect(stored).not.toContain(codeFromSms());
    });

    it("gives the same answer for an unknown email and a wrong password, and texts nothing", async () => {
      const user = await createPlatformUser();

      const unknown = await request(app).post(`${BASE}/login`).send({ email: "nobody@platform.test", password: PASSWORD }).expect(401);
      const wrong = await request(app).post(`${BASE}/login`).send({ email: user.email, password: "wrong-password" }).expect(401);

      expect(unknown.body.message).toBe("Invalid credentials");
      expect(wrong.body.message).toBe("Invalid credentials");
      expect(sendPlatformSms).not.toHaveBeenCalled();
      expect(await PlatformAuditLog.countDocuments({ action: "PLATFORM_LOGIN_FAILED", actor: user._id })).toBe(1);
    });

    it("rejects a deactivated account", async () => {
      const user = await createPlatformUser({ isActive: false });
      await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(403);
      expect(sendPlatformSms).not.toHaveBeenCalled();
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

    it("reports a send failure instead of leaving a usable challenge behind", async () => {
      const user = await createPlatformUser();
      sendPlatformSms.mockRejectedValueOnce(new Error("provider down"));

      const res = await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(503);
      expect(res.body.code || res.body.errorCode).toBeDefined();
    });
  });

  describe("POST /verify-otp", () => {
    it("exchanges the code for an access token and a refresh cookie", async () => {
      const { user, res } = await signIn();

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

    it("rejects a wrong code, and burns the challenge after too many guesses", async () => {
      const user = await createPlatformUser();
      const start = await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(200);
      const { challengeId } = start.body.data;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(app).post(`${BASE}/verify-otp`).send({ challengeId, code: "000000" }).expect(401);
      }

      // The real code no longer works: the challenge is gone
      await request(app).post(`${BASE}/verify-otp`).send({ challengeId, code: codeFromSms() }).expect(401);
      expect(await PlatformAuditLog.countDocuments({ action: "PLATFORM_LOGIN_OTP_FAILED" })).toBe(6);
    });

    it("consumes the code, so it cannot be replayed", async () => {
      const user = await createPlatformUser();
      const start = await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(200);
      const body = { challengeId: start.body.data.challengeId, code: codeFromSms() };

      await request(app).post(`${BASE}/verify-otp`).send(body).expect(200);
      await request(app).post(`${BASE}/verify-otp`).send(body).expect(401);
    });

    it("rejects a code once it has expired", async () => {
      const user = await createPlatformUser();
      const start = await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(200);
      const body = { challengeId: start.body.data.challengeId, code: codeFromSms() };

      const realNow = Date.now;
      Date.now = () => realNow() + 5 * 60 * 1000 + 1000;
      try {
        await request(app).post(`${BASE}/verify-otp`).send(body).expect(401);
      } finally {
        Date.now = realNow;
      }
    });

    it("rejects an unknown challenge and a malformed code", async () => {
      await request(app)
        .post(`${BASE}/verify-otp`)
        .send({ challengeId: "11111111-2222-3333-4444-555555555555", code: "123456" })
        .expect(401);
      await request(app).post(`${BASE}/verify-otp`).send({ challengeId: "not-a-uuid", code: "123456" }).expect(400);
      await request(app)
        .post(`${BASE}/verify-otp`)
        .send({ challengeId: "11111111-2222-3333-4444-555555555555", code: "12" })
        .expect(400);
    });
  });

  describe("POST /resend-otp", () => {
    it("sends a fresh code and invalidates the previous one", async () => {
      const user = await createPlatformUser();
      const first = await request(app).post(`${BASE}/login`).send({ email: user.email, password: PASSWORD }).expect(200);
      const firstCode = codeFromSms();

      // A resend right away is refused: the operator's phone is not a target
      await request(app)
        .post(`${BASE}/resend-otp`)
        .send({ email: user.email, password: PASSWORD, challengeId: first.body.data.challengeId })
        .expect(429);

      const realNow = Date.now;
      Date.now = () => realNow() + 61 * 1000;
      let second;
      try {
        second = await request(app)
          .post(`${BASE}/resend-otp`)
          .send({ email: user.email, password: PASSWORD, challengeId: first.body.data.challengeId })
          .expect(200);
      } finally {
        Date.now = realNow;
      }

      expect(second.body.data.challengeId).not.toBe(first.body.data.challengeId);
      await request(app).post(`${BASE}/verify-otp`).send({ challengeId: first.body.data.challengeId, code: firstCode }).expect(401);
      await request(app)
        .post(`${BASE}/verify-otp`)
        .send({ challengeId: second.body.data.challengeId, code: codeFromSms() })
        .expect(200);
    });

    it("requires the password again", async () => {
      const user = await createPlatformUser();
      await request(app).post(`${BASE}/resend-otp`).send({ email: user.email, password: "wrong-password" }).expect(401);
      expect(sendPlatformSms).not.toHaveBeenCalled();
    });
  });

  describe("POST /refresh and /logout, GET /me", () => {
    it("issues a new access token from the refresh cookie", async () => {
      const { user, cookie } = await signIn();
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
      const { user, accessToken } = await signIn();
      const res = await request(app).get(`${BASE}/me`).set("Authorization", `Bearer ${accessToken}`).expect(200);
      expect(res.body.data).toMatchObject({ _id: user._id.toString(), email: user.email });
    });

    it("logout revokes every issued token and clears the cookie", async () => {
      const { cookie, accessToken } = await signIn();

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
