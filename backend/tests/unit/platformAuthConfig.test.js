const { getPlatformAuthConfig } = require("../../src/config/platformAuth.config");
const { PLATFORM_ENV } = require("../helpers/platform");

describe("getPlatformAuthConfig", () => {
  const envBackup = { ...process.env };
  beforeEach(() => Object.assign(process.env, PLATFORM_ENV));
  afterEach(() => {
    process.env = { ...envBackup };
  });

  it("returns the platform secrets and defaults", () => {
    expect(getPlatformAuthConfig()).toEqual({
      accessSecret: PLATFORM_ENV.PLATFORM_ACCESS_TOKEN_SECRET,
      refreshSecret: PLATFORM_ENV.PLATFORM_REFRESH_TOKEN_SECRET,
      accessExpiresIn: "1h",
      refreshExpiresIn: "7d",
    });
  });

  it("uses configured expiries", () => {
    process.env.PLATFORM_ACCESS_TOKEN_EXPIRY = "15m";
    process.env.PLATFORM_REFRESH_TOKEN_EXPIRY = "1d";
    expect(getPlatformAuthConfig()).toMatchObject({ accessExpiresIn: "15m", refreshExpiresIn: "1d" });
  });

  it.each(["PLATFORM_ACCESS_TOKEN_SECRET", "PLATFORM_REFRESH_TOKEN_SECRET"])("rejects a missing %s", (key) => {
    delete process.env[key];
    expect(() => getPlatformAuthConfig()).toThrow(/platform auth is not configured/i);
  });

  it("rejects secrets shorter than 32 characters", () => {
    process.env.PLATFORM_ACCESS_TOKEN_SECRET = "short";
    expect(() => getPlatformAuthConfig()).toThrow(/at least 32/);
  });

  it("rejects platform secrets that reuse a staff secret or each other", () => {
    process.env.PLATFORM_ACCESS_TOKEN_SECRET = PLATFORM_ENV.ACCESS_TOKEN_SECRET;
    expect(() => getPlatformAuthConfig()).toThrow(/must differ/);

    Object.assign(process.env, PLATFORM_ENV);
    process.env.PLATFORM_REFRESH_TOKEN_SECRET = PLATFORM_ENV.PLATFORM_ACCESS_TOKEN_SECRET;
    expect(() => getPlatformAuthConfig()).toThrow(/must differ/);
  });

  it("marks configuration errors as 500s", () => {
    delete process.env.PLATFORM_ACCESS_TOKEN_SECRET;
    try {
      getPlatformAuthConfig();
    } catch (error) {
      expect(error.statusCode).toBe(500);
    }
    expect.assertions(1);
  });
});
