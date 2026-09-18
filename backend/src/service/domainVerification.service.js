const dns = require("dns/promises");

/**
 * Proves a seller controls the hostname they asked us to route to their store.
 *
 * Without this step, adding a domain would be an unchecked claim: type
 * `competitor.com` into the platform console and any visitor arriving there
 * gets served your catalogue. Requiring a TXT record the seller can only
 * publish from their own DNS turns that claim into evidence.
 *
 * The record lives at a dedicated subdomain rather than the apex so it does not
 * collide with SPF, DMARC or other TXT records the domain already carries.
 */

const RECORD_PREFIX = "_velor-verify";
const VALUE_PREFIX = "velor-verify=";

// A DNS server that never answers would otherwise hold the request open for the
// resolver's own (much longer) timeout.
const LOOKUP_TIMEOUT_MS = 5000;

const recordName = (host) => `${RECORD_PREFIX}.${host}`;
const recordValue = (token) => `${VALUE_PREFIX}${token}`;

// What the operator hands the seller to paste into their DNS panel
const dnsInstructions = (domain) => ({
  type: "TXT",
  name: recordName(domain.host),
  value: recordValue(domain.verificationToken),
});

/**
 * The DNS resolver in use. Swappable so tests can exercise the outcomes of a
 * lookup — matching record, wrong record, none published — without depending on
 * real DNS, which would make the suite slow and non-deterministic.
 */
let activeResolver = dns;
const setResolver = (resolver) => {
  activeResolver = resolver || dns;
};

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error("DNS lookup timed out")), ms);
      // Do not hold the process open just for this timer
      if (typeof timer.unref === "function") timer.unref();
    }),
  ]);

/**
 * Reads the TXT records at the verification subdomain.
 *
 * Node returns each record as an array of strings, because a single TXT record
 * can be split into 255-byte chunks; joining them back is what the DNS spec
 * asks for and is what registrars' UIs imply when they show one long value.
 */
const readTxtRecords = async (host, { resolver = activeResolver } = {}) => {
  const records = await withTimeout(resolver.resolveTxt(recordName(host)), LOOKUP_TIMEOUT_MS);
  return records.map((chunks) => (Array.isArray(chunks) ? chunks.join("") : String(chunks)).trim());
};

/**
 * Checks the domain's DNS and moves it to "active" or "failed".
 *
 * Failure is never permanent: DNS changes take time to propagate, so a seller
 * who has just added the record may legitimately fail the first check. The
 * reason is stored so the console can say which of the two happened — no record
 * at all, or a record that does not match.
 *
 * Callers must invalidate the tenant cache afterwards; a newly active domain is
 * otherwise invisible for up to the cache TTL.
 */
const verifyDomain = async (domain, { resolver = activeResolver } = {}) => {
  const expected = recordValue(domain.verificationToken);
  domain.lastCheckedAt = new Date();

  let found = [];
  try {
    found = await readTxtRecords(domain.host, { resolver });
  } catch (error) {
    domain.status = "failed";
    // ENOTFOUND/ENODATA simply mean "not published yet", which is the common case
    domain.failureReason =
      error.code === "ENOTFOUND" || error.code === "ENODATA"
        ? `No TXT record found at ${recordName(domain.host)}`
        : `DNS lookup failed: ${error.message}`;
    await domain.save();
    return domain;
  }

  if (!found.includes(expected)) {
    domain.status = "failed";
    domain.failureReason = found.length
      ? `TXT record at ${recordName(domain.host)} does not match the expected value`
      : `No TXT record found at ${recordName(domain.host)}`;
    await domain.save();
    return domain;
  }

  domain.status = "active";
  domain.verifiedAt = new Date();
  domain.failureReason = "";
  await domain.save();
  return domain;
};

module.exports = {
  verifyDomain,
  setResolver,
  dnsInstructions,
  recordName,
  recordValue,
  RECORD_PREFIX,
  VALUE_PREFIX,
  LOOKUP_TIMEOUT_MS,
};
