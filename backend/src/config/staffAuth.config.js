const { isProduction, isTest } = require("./nodeEnv");

/**
 * The staff token secrets, checked rather than assumed.
 *
 * These two secrets are the whole of multi-tenant isolation: a forged access
 * token names any tenant it likes, and every scoping rule downstream trusts it.
 * A short secret is brute-forceable offline from a single captured token, so it
 * is not a weaker version of security — it is none.
 *
 * The platform secrets have been validated this way since they were introduced
 * (`platformAuth.config.js`); this is the same rule for the staff pair, which
 * had been read straight from the environment with no check at all.
 *
 * `REFRESH_TOKEN_SCCERET` keeps its historical misspelling: renaming the
 * variable would silently sign everyone out of a running deployment.
 */

const MIN_SECRET_LENGTH = 32;

const describe = (name, value) =>
  value ? `${name} is ${value.length} characters` : `${name} is not set`;

/**
 * Returns the problems with the current secrets, empty when they are sound.
 * Separate from the throwing check so a caller can decide what to do with them.
 */
const staffSecretProblems = () => {
  const access = process.env.ACCESS_TOKEN_SECRET;
  const refresh = process.env.REFRESH_TOKEN_SCCERET;
  const problems = [];

  for (const [name, value] of [["ACCESS_TOKEN_SECRET", access], ["REFRESH_TOKEN_SCCERET", refresh]]) {
    if (!value) problems.push(`${name} is not set`);
    else if (value.length < MIN_SECRET_LENGTH) {
      problems.push(`${describe(name, value)}, minimum is ${MIN_SECRET_LENGTH}`);
    }
  }

  // One secret for both means a refresh token is accepted as an access token:
  // its longer lifetime then becomes the session's real lifetime.
  if (access && refresh && access === refresh) {
    problems.push("ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SCCERET must differ");
  }

  const platform = [process.env.PLATFORM_ACCESS_TOKEN_SECRET, process.env.PLATFORM_REFRESH_TOKEN_SECRET].filter(Boolean);
  if (platform.some((secret) => secret === access || secret === refresh)) {
    problems.push("staff secrets must differ from the platform token secrets");
  }

  return problems;
};

/**
 * Called once at boot. Refuses to start on a bad configuration rather than
 * serving traffic that cannot be trusted.
 *
 * Outside production it warns instead: a developer with a throwaway `.env`
 * should not be blocked, and the test suite signs its own tokens.
 */
const assertStaffSecrets = ({ exit = true } = {}) => {
  const problems = staffSecretProblems();
  if (!problems.length) return problems;

  const detail = problems.map((line) => `  - ${line}`).join("\n");

  if (isProduction()) {
    console.error(`Refusing to start: the staff token secrets are unsafe.\n${detail}\n` +
      "  Generate one with: openssl rand -base64 48");
    if (exit) process.exit(1);
    return problems;
  }

  if (!isTest()) {
    console.warn(`[auth] staff token secrets are unsafe (this would refuse to start in production):\n${detail}`);
  }
  return problems;
};

module.exports = { MIN_SECRET_LENGTH, staffSecretProblems, assertStaffSecrets };
