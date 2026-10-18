const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { runForTenant } = require("../../src/tenancy/context");
const Role = require("../../src/models/role.model");
const User = require("../../src/models/user.model");
const Permission = require("../../src/models/permisson.model");

/**
 * Tokens shaped exactly like the ones user.model.js mints:
 *   { id, sub, tid, tv, aud }
 * signed with the test ACCESS_TOKEN_SECRET (tests/setup/test.env).
 */
const claimsFor = (user, { tenantId, aud, tv } = {}) => ({
  id: String(user._id),
  sub: String(user._id),
  ...((tenantId || user.tenantId) ? { tid: String(tenantId || user.tenantId) } : {}),
  tv: tv ?? user.tokenVersion ?? 0,
  aud: aud ?? (user.roles?.length ? "staff" : "shopper"),
});

const tokenFor = (user, { secret = process.env.ACCESS_TOKEN_SECRET, expiresIn = "15m", ...claims } = {}) =>
  jwt.sign(claimsFor(user, claims), secret, { expiresIn });

const expiredTokenFor = (user, claims = {}) =>
  jwt.sign({ ...claimsFor(user, claims), iat: Math.floor(Date.now() / 1000) - 3600, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.ACCESS_TOKEN_SECRET);

const wrongSignatureTokenFor = (user, claims = {}) =>
  tokenFor(user, { ...claims, secret: "an-attacker-chosen-secret-that-is-long-enough-000" });

// Signed with the refresh secret: must never pass as an access token
const refreshSecretTokenFor = (user, claims = {}) =>
  tokenFor(user, { ...claims, secret: process.env.REFRESH_TOKEN_SCCERET });

const MALFORMED_TOKENS = ["not-a-jwt", "a.b.c", "Bearer", "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxIn0."];

// `alg: none` — the classic forgery
const unsignedTokenFor = (user, claims = {}) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none", typ: "JWT" })}.${b64(claimsFor(user, claims))}.`;
};

// Permission rows are global; `slug` is what authorize(module, action) compares.
const ensurePermissionSlug = (slug) =>
  Permission.findOneAndUpdate(
    { slug },
    { $setOnInsert: { permissionName: slug, slug, isActive: true } },
    { upsert: true, new: true },
  );

let phoneSeq = 0;
const uniquePhone = () => `017${String(process.pid % 1000).padStart(3, "0")}${String((phoneSeq += 1)).padStart(5, "0")}`;

/**
 * Creates a staff user in a tenant.
 *   grants: { "retail-sales": ["view", "add"], ... }  → one role holding them
 *   owner: true → holds the owner role (bypasses permission checks)
 *   shopper: true → no roles at all (storefront account)
 */
// bcrypt is slow on purpose; matrix tests that need hundreds of users insert
// them raw (`raw: true`) with this one precomputed hash of "Passw0rd!".
let rawHash = null;
const passwordHash = async () => {
  if (!rawHash) rawHash = await require("bcrypt").hash("Passw0rd!", 4);
  return rawHash;
};

const createUserIn = async (tenant, { grants = {}, owner = false, shopper = false, password = "Passw0rd!", email, raw = false, ...fields } = {}) => {
  const tenantId = tenant._id || tenant;
  const permissions = [];
  for (const [slug, actions] of Object.entries(grants)) {
    const permission = await ensurePermissionSlug(slug);
    permissions.push({ permission: permission._id, actions });
  }

  return runForTenant(tenantId, async () => {
    let roles = [];
    if (!shopper) {
      const roleSlug = owner ? "owner" : `staff-${new mongoose.Types.ObjectId().toString().slice(-8)}`;
      const existing = owner ? await Role.findOne({ slug: "owner" }) : null;
      const role = existing || (await Role.collection.insertOne({
        tenantId, name: roleSlug, slug: roleSlug, isActive: true, permissions, createdAt: new Date(), updatedAt: new Date(),
      }).then(({ insertedId }) => ({ _id: insertedId })));
      roles = [role._id];
    }
    const doc = {
      name: fields.name || (owner ? "Owner" : shopper ? "Shopper" : "Staff"),
      email: email || `${new mongoose.Types.ObjectId().toString()}@test.example`,
      password,
      phone: fields.phone || uniquePhone(),
      roles,
      ...fields,
    };
    if (!raw) return User.create(doc);
    const now = new Date();
    const { insertedId } = await User.collection.insertOne({
      isActive: true, isBlocked: false, tokenVersion: 0, permissions: [], ...doc,
      password: await passwordHash(), tenantId, createdAt: now, updatedAt: now,
    });
    return User.findById(insertedId);
  });
};

// A user plus a valid bearer header for it
const sessionFor = async (tenant, options = {}) => {
  const user = await createUserIn(tenant, options);
  const token = tokenFor(user);
  return { user, token, headers: { Authorization: `Bearer ${token}` } };
};

module.exports = {
  claimsFor,
  tokenFor,
  expiredTokenFor,
  wrongSignatureTokenFor,
  refreshSecretTokenFor,
  unsignedTokenFor,
  MALFORMED_TOKENS,
  ensurePermissionSlug,
  createUserIn,
  sessionFor,
  uniquePhone,
};
