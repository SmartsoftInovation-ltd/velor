const jwt = require("jsonwebtoken");
const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setPlatformEnv, createPlatformUser, buildPlatformApp, PLATFORM_ENV } = require("../helpers/platform");
const { platformGuard, requirePlatformRole } = require("../../src/middleware/platformGuard.middleware");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const { authGuard } = require("../../src/middleware/authMiddleware");
const { isPlatform } = require("../../src/tenancy/context");

describe("platformGuard", () => {
  let app;

  beforeAll(async () => {
    setPlatformEnv();
    await connectTestDb();
    app = buildPlatformApp((a) => {
      a.get("/guarded", platformGuard, (req, res) =>
        res.json({ id: req.platformUser._id, platform: isPlatform() }),
      );
      a.get("/superadmin-only", platformGuard, requirePlatformRole("superadmin"), (req, res) => res.json({ ok: true }));
      a.get("/staff", authGuard, (req, res) => res.json({ ok: true }));
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(clearTestDb);
  afterAll(async () => {
    jest.restoreAllMocks();
    await disconnectTestDb();
  });

  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  it("rejects a request without a token", async () => {
    await request(app).get("/guarded").expect(401);
  });

  it("accepts a valid platform token and runs the handler in platform scope", async () => {
    const user = await createPlatformUser();
    const res = await request(app).get("/guarded").set(bearer(signPlatformAccessToken(user))).expect(200);

    expect(res.body).toEqual({ id: user._id.toString(), platform: true });
  });

  it("rejects a staff token", async () => {
    const user = await createPlatformUser();
    const staffToken = jwt.sign({ id: user._id, email: user.email }, PLATFORM_ENV.ACCESS_TOKEN_SECRET);
    await request(app).get("/guarded").set(bearer(staffToken)).expect(401);
  });

  it("rejects a token signed with the platform secret but the wrong audience", async () => {
    const user = await createPlatformUser();
    const token = jwt.sign({ tv: 0 }, PLATFORM_ENV.PLATFORM_ACCESS_TOKEN_SECRET, {
      subject: user._id.toString(),
      audience: "staff",
    });
    await request(app).get("/guarded").set(bearer(token)).expect(401);
  });

  it("rejects the refresh token used as an access token", async () => {
    const user = await createPlatformUser();
    const { signPlatformRefreshToken } = require("../../src/utils/platformTokens");
    await request(app).get("/guarded").set(bearer(signPlatformRefreshToken(user))).expect(401);
  });

  it("rejects a token for an inactive user or an outdated token version", async () => {
    const inactive = await createPlatformUser({ isActive: false });
    await request(app).get("/guarded").set(bearer(signPlatformAccessToken(inactive))).expect(401);

    const user = await createPlatformUser();
    const token = signPlatformAccessToken(user);
    user.tokenVersion += 1;
    await user.save();
    await request(app).get("/guarded").set(bearer(token)).expect(401);
  });

  it("enforces platform roles", async () => {
    const support = await createPlatformUser({ role: "support" });
    const admin = await createPlatformUser({ role: "superadmin" });

    await request(app).get("/superadmin-only").set(bearer(signPlatformAccessToken(support))).expect(403);
    await request(app).get("/superadmin-only").set(bearer(signPlatformAccessToken(admin))).expect(200);
  });

  it("platform tokens do not work on staff routes", async () => {
    const user = await createPlatformUser();
    await request(app).get("/staff").set(bearer(signPlatformAccessToken(user))).expect(401);
  });
});
