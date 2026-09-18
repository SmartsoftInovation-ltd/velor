const { staffSecretProblems, assertStaffSecrets, MIN_SECRET_LENGTH } = require("../../src/config/staffAuth.config");

const STRONG_A = "a".repeat(48);
const STRONG_B = "b".repeat(48);

describe("staff token secret validation", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.PLATFORM_ACCESS_TOKEN_SECRET;
    delete process.env.PLATFORM_REFRESH_TOKEN_SECRET;
    process.env.ACCESS_TOKEN_SECRET = STRONG_A;
    process.env.REFRESH_TOKEN_SCCERET = STRONG_B;
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
  });

  it("accepts two long, distinct secrets", () => {
    expect(staffSecretProblems()).toEqual([]);
  });

  // The length is the whole point: a six-character secret is brute-forceable
  // offline from one captured token, and a forged token names any tenant.
  it.each([
    ["taufik", "ACCESS_TOKEN_SECRET is 6 characters"],
    ["WS", "ACCESS_TOKEN_SECRET is 2 characters"],
    ["x".repeat(MIN_SECRET_LENGTH - 1), `ACCESS_TOKEN_SECRET is ${MIN_SECRET_LENGTH - 1} characters`],
  ])("rejects a %s-length access secret", (secret, message) => {
    process.env.ACCESS_TOKEN_SECRET = secret;
    expect(staffSecretProblems()).toContainEqual(expect.stringContaining(message));
  });

  it("accepts exactly the minimum length", () => {
    process.env.ACCESS_TOKEN_SECRET = "x".repeat(MIN_SECRET_LENGTH);
    expect(staffSecretProblems()).toEqual([]);
  });

  it.each(["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SCCERET"])("rejects a missing %s", (name) => {
    delete process.env[name];
    expect(staffSecretProblems()).toContainEqual(`${name} is not set`);
  });

  // One secret for both means a refresh token verifies as an access token, and
  // its much longer lifetime silently becomes the session's real lifetime.
  it("rejects one secret used for both tokens", () => {
    process.env.REFRESH_TOKEN_SCCERET = STRONG_A;
    expect(staffSecretProblems()).toContainEqual(expect.stringMatching(/must differ/));
  });

  // Separate secrets are what stop a staff token verifying as a platform token
  it.each(["PLATFORM_ACCESS_TOKEN_SECRET", "PLATFORM_REFRESH_TOKEN_SECRET"])(
    "rejects a staff secret reused as %s",
    (name) => {
      process.env[name] = STRONG_A;
      expect(staffSecretProblems()).toContainEqual(expect.stringMatching(/differ from the platform token secrets/));
    },
  );

  describe("at boot", () => {
    it("returns without complaint when the secrets are sound", () => {
      process.env.NODE_ENV = "production";
      expect(assertStaffSecrets({ exit: false })).toEqual([]);
      expect(console.error).not.toHaveBeenCalled();
    });

    it("refuses to start in production, naming every problem", () => {
      process.env.NODE_ENV = "production";
      process.env.ACCESS_TOKEN_SECRET = "taufik";
      delete process.env.REFRESH_TOKEN_SCCERET;

      const problems = assertStaffSecrets({ exit: false });

      expect(problems).toHaveLength(2);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("Refusing to start"));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining("openssl rand -base64 48"));
    });

    // A developer with a throwaway .env should be told, not blocked
    it("only warns outside production", () => {
      process.env.NODE_ENV = "development";
      process.env.ACCESS_TOKEN_SECRET = "short";

      expect(assertStaffSecrets({ exit: false })).not.toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("would refuse to start in production"));
      expect(console.error).not.toHaveBeenCalled();
    });

    it("stays quiet under test, where tokens are signed with fixtures", () => {
      process.env.NODE_ENV = "test";
      process.env.ACCESS_TOKEN_SECRET = "short";

      assertStaffSecrets({ exit: false });
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});
