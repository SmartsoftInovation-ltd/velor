/**
 * NODE_ENV, read in one place.
 *
 * `.env` shipped "developement" for a long time, so a bare
 * `NODE_ENV === "production"` check had a second way to be false: the wrong
 * spelling. Deployments that still carry the misspelling keep working — it is
 * normalised here — but only "production" is ever production, so a typo can
 * never silently turn on development behaviour in a live install.
 */

const DEV_SPELLINGS = new Set(["development", "developement", "dev"]);

const nodeEnv = () => process.env.NODE_ENV || "development";

const isProduction = () => nodeEnv() === "production";

// Development only when NODE_ENV says so. An unset NODE_ENV (a deployment
// that forgot it) gets the safe behaviour — no stack traces, no localhost
// CORS — rather than the default above, which only names the queue prefix.
const isDevelopment = () => DEV_SPELLINGS.has(process.env.NODE_ENV);

const isTest = () => nodeEnv() === "test";

module.exports = { nodeEnv, isProduction, isDevelopment, isTest };
