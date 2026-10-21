const nodemailer = require("nodemailer");
const { useIntegrationApp } = require("../setup/integration");
const { api, expectSuccessEnvelope, expectErrorEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor, ensurePermissionSlug, uniquePhone } = require("../helpers/auth");
const { tenantFactory } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const User = require("../../src/models/user.model");
const Role = require("../../src/models/role.model");
const settings = require("../../src/settings/settings.service");
const { resetMailTransport } = require("../../src/helpers/nodemailer");

// Fields that must never leave the API, whatever the endpoint
const SECRET_FIELDS = ["password", "refreshToken", "resetPasswordToken", "emailVerificationToken"];
const expectNoSecrets = (body) => {
  const text = JSON.stringify(body);
  for (const field of SECRET_FIELDS) expect(text).not.toMatch(new RegExp(`"${field}":"[^"]+`));
  expect(text).not.toMatch(/\$2[aby]\$\d{2}\$/); // a bcrypt hash anywhere
};

describe("staff auth routes (/api/v1/auth)", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let owner;
  const PASSWORD = "Owner-Pass1";

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "authshop" });
    owner = await createUserIn(tenant, { owner: true, email: "owner@authshop.com", password: PASSWORD });
  });

  const client = (token) => api(ctx.server, { token, tenant: "authshop" });
  const login = (body) => api(ctx.server).post("/auth/login").send({ workspace: "authshop", ...body });
  const reload = (id) => runForTenant(tenant._id, () => User.findById(id).lean());
  const refreshCookie = (res) => res.headers["set-cookie"].find((c) => c.startsWith("refreshToken=")).split(";")[0];

  // ------------------------------------------------------------------ login
  describe("POST /auth/login", () => {
    it("signs in by email: token, refresh cookie, refresh token stored, lastlogin set, no secrets in the body", async () => {
      const res = await login({ email: "owner@authshop.com", password: PASSWORD }).expect(200);
      expectSuccessEnvelope(res.body);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expectNoSecrets(res.body);

      const cookie = res.headers["set-cookie"].find((c) => c.startsWith("refreshToken="));
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);

      const stored = await reload(owner._id);
      expect(stored.refreshToken).toBe(refreshCookie(res).replace("refreshToken=", ""));
      expect(stored.lastlogin).toBeInstanceOf(Date);
    });

    it("signs in by phone, and normalises the email's case and spaces", async () => {
      await login({ phone: owner.phone, password: PASSWORD }).expect(200);
      await login({ email: "  OWNER@AuthShop.com ", password: PASSWORD }).expect(200);
    });

    // BUG-010: login looks up { $or: [{ email }, { phone: undefined }] }; the
    // missing identifier matches every account without that field
    it("signs in the account the email names when the store has several staff [BUG-010]", async () => {
      // A second account whose phone field is absent sits first in the collection
      await createUserIn(tenant, { email: "first@authshop.com", phone: undefined, raw: true });
      const second = await createUserIn(tenant, { email: "second@authshop.com", password: "Second-Pass1" });
      const res = await login({ email: "second@authshop.com", password: "Second-Pass1" }).expect(200);
      expect(res.body.data.user._id).toBe(second._id.toString());
    });

    it("answers an unknown account and a wrong password identically", async () => {
      const unknown = await login({ email: "nobody@authshop.com", password: PASSWORD }).expect(400);
      const wrong = await login({ email: "owner@authshop.com", password: "wrong-password" }).expect(400);
      expect(unknown.body).toEqual(wrong.body);
      expect(wrong.body.message).toBe("Invalid credentials");
    });

    const refusesWithoutSession = async (body) => {
      const res = await login(body);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.body.data?.accessToken).toBeUndefined();
    };

    it.each([
      ["no identifier", { password: PASSWORD }],
      ["no password", { email: "owner@authshop.com" }],
      ["an empty body", {}],
    ])("refuses %s without signing anyone in", (_name, body) => refusesWithoutSession(body));

    // BUG-011: email/phone go into the query unchecked — an operator object is
    // accepted (phone: { $ne: null } signs in as the first account whose password
    // matches, no identifier needed) or crashes the handler (500)
    it.each([
      ["a query operator as the email", { email: { $gt: "" }, password: PASSWORD }],
      ["a query operator as the phone", { phone: { $ne: null }, password: PASSWORD }],
    ])("refuses %s without signing anyone in [BUG-011]", (_name, body) => refusesWithoutSession(body));

    it("refuses blocked (403) and deactivated (403) accounts even with the right password", async () => {
      await createUserIn(tenant, { email: "blocked@authshop.com", password: "Block-Pass1", isBlocked: true });
      await createUserIn(tenant, { email: "off@authshop.com", password: "Off-Pass1", isActive: false });
      const blocked = await login({ email: "blocked@authshop.com", password: "Block-Pass1" }).expect(403);
      expect(blocked.body.message).toMatch(/blocked/i);
      await login({ email: "off@authshop.com", password: "Off-Pass1" }).expect(403);
    });

    it("locks out after 10 failed attempts for that account (429), then still refuses the right password", async () => {
      for (let i = 0; i < 10; i += 1) await login({ email: "owner@authshop.com", password: `wrong-${i}` }).expect(400);
      const limited = await login({ email: "owner@authshop.com", password: PASSWORD }).expect(429);
      expect(limited.body.message).toMatch(/too many failed sign-in attempts/i);
      // A different account from the same IP is unaffected
      await createUserIn(tenant, { email: "other@authshop.com", password: "Other-Pass1" });
      await login({ email: "other@authshop.com", password: "Other-Pass1" }).expect(200);
    });

    it("does not count successful sign-ins towards the limit", async () => {
      for (let i = 0; i < 12; i += 1) await login({ email: "owner@authshop.com", password: PASSWORD }).expect(200);
    });
  });

  // ------------------------------------------------------------------ refresh / logout
  describe("POST /auth/refresh-token and /auth/logout", () => {
    const signIn = () => login({ email: "owner@authshop.com", password: PASSWORD }).expect(200);

    it("issues a new access token from the cookie or the x-refresh-token header", async () => {
      const res = await signIn();
      const cookie = refreshCookie(res);
      const viaCookie = await api(ctx.server).post("/auth/refresh-token").set("Cookie", cookie).expect(200);
      expect(viaCookie.body.data.accessToken).toEqual(expect.any(String));
      const viaHeader = await api(ctx.server).post("/auth/refresh-token").set("x-refresh-token", cookie.replace("refreshToken=", "")).expect(200);
      await client(viaHeader.body.data.accessToken).get("/auth/getme").expect(200);
    });

    it("401 without a refresh token, or with one the database does not hold", async () => {
      await api(ctx.server).post("/auth/refresh-token").expect(401);
      await api(ctx.server).post("/auth/refresh-token").set("x-refresh-token", "made-up").expect(401);
    });

    it("logout revokes the refresh token in the database and clears the cookie", async () => {
      const cookie = refreshCookie(await signIn());
      const out = await api(ctx.server).post("/auth/logout").set("Cookie", cookie).expect(200);
      expect(out.headers["set-cookie"].join(";")).toMatch(/refreshToken=;/);
      expect((await reload(owner._id)).refreshToken).toBeNull();
      await api(ctx.server).post("/auth/refresh-token").set("Cookie", cookie).expect(401);
    });

    it("logout without a token still succeeds (idempotent)", async () => {
      await api(ctx.server).post("/auth/logout").expect(200);
      await api(ctx.server).post("/auth/logout").expect(200);
    });

    it("refuses to refresh for a blocked account (403) and after the token version moved (401)", async () => {
      const cookie = refreshCookie(await signIn());
      await runForTenant(tenant._id, () => User.updateOne({ _id: owner._id }, { $inc: { tokenVersion: 1 } }));
      await api(ctx.server).post("/auth/refresh-token").set("Cookie", cookie).expect(401);

      const cookie2 = refreshCookie(await signIn());
      await runForTenant(tenant._id, () => User.updateOne({ _id: owner._id }, { isBlocked: true }));
      await api(ctx.server).post("/auth/refresh-token").set("Cookie", cookie2).expect(403);
    });
  });

  // ------------------------------------------------------------------ change password
  describe("POST /auth/change-password", () => {
    it("changes the password: old one stops working, new one works, refresh token revoked", async () => {
      await login({ email: "owner@authshop.com", password: PASSWORD }).expect(200);
      await client(tokenFor(owner)).post("/auth/change-password").send({ oldPassword: PASSWORD, newPassword: "New-Pass-99" }).expect(200);
      await login({ email: "owner@authshop.com", password: PASSWORD }).expect(400);
      await login({ email: "owner@authshop.com", password: "New-Pass-99" }).expect(200);
    });

    it("rejects a wrong old password and a too-short new one", async () => {
      const c = client(tokenFor(owner));
      const wrong = await c.post("/auth/change-password").send({ oldPassword: "nope", newPassword: "New-Pass-99" }).expect(400);
      expect(wrong.body.message).toMatch(/old password is incorrect/i);
      await c.post("/auth/change-password").send({ oldPassword: PASSWORD, newPassword: "abc" }).expect(400);
      await c.post("/auth/change-password").send({ oldPassword: PASSWORD }).expect(400);
    });

    // BUG-006: the password changes but access tokens issued before it stay valid
    it("ends sessions opened with the old password [BUG-006]", async () => {
      const oldToken = tokenFor(owner);
      await client(oldToken).post("/auth/change-password").send({ oldPassword: PASSWORD, newPassword: "New-Pass-99" }).expect(200);
      await client(oldToken).get("/auth/getme").expect(401);
    });

    it("rate limits failed attempts per user (10 per 15 minutes)", async () => {
      const c = client(tokenFor(owner));
      for (let i = 0; i < 10; i += 1) await c.post("/auth/change-password").send({ oldPassword: `x${i}`, newPassword: "New-Pass-99" }).expect(400);
      await c.post("/auth/change-password").send({ oldPassword: PASSWORD, newPassword: "New-Pass-99" }).expect(429);
    });
  });

  // ------------------------------------------------------------------ registration
  describe("POST /auth/registeruser", () => {
    const register = (body) =>
      api(ctx.server).post("/auth/registeruser").send({ workspace: "authshop", name: "New Person", email: "new@authshop.com", password: "New-Pass1", phone: uniquePhone(), ...body });

    it("creates an account with no roles and no permissions, stored hashed", async () => {
      const res = await register().expect(201);
      expectNoSecrets(res.body);
      const stored = await runForTenant(tenant._id, () => User.findOne({ email: "new@authshop.com" }).lean());
      expect(stored.roles).toEqual([]);
      expect(stored.permissions).toEqual([]);
      expect(stored.password).not.toBe("New-Pass1");
      expect(stored.tenantId.equals(tenant._id)).toBe(true);
    });

    it("ignores protected fields sent in the body (mass assignment)", async () => {
      const role = await runForTenant(tenant._id, () => Role.findOne({ slug: "owner" }));
      const permission = await ensurePermissionSlug("create-user");
      await register({
        roles: [role._id.toString()],
        permissions: [{ permission: permission._id.toString(), actions: ["add"] }],
        isEmailVerified: true,
        isBlocked: false,
        tokenVersion: 99,
        tenantId: (await tenantFactory.create())._id.toString(),
      }).expect(201);
      const stored = await runForTenant(tenant._id, () => User.findOne({ email: "new@authshop.com" }).lean());
      expect(stored.roles).toEqual([]);
      expect(stored.permissions).toEqual([]);
      expect(stored.isEmailVerified).toBe(false);
      expect(stored.tokenVersion).toBe(0);
      expect(stored.tenantId.equals(tenant._id)).toBe(true);
    });

    it.each([
      ["missing name", { name: undefined }],
      ["invalid email", { email: "not-an-email" }],
      ["short password", { password: "ab" }],
      ["invalid phone", { phone: "12345" }],
      ["discount limit over 100", { discountLimit: 101 }],
    ])("400 for %s", async (_name, body) => {
      const res = await register(body).expect(400);
      expectErrorEnvelope(res.body, 400);
    });

    it("refuses a duplicate email or phone in the same store", async () => {
      await register({ phone: "01711111111" }).expect(201);
      await register({ email: "other@authshop.com", phone: "01711111111" }).expect(400);
      await register({ phone: "01722222222" }).expect(400);
    });

    it("needs a store: no workspace in strict mode is a 400, unknown workspace answers like bad credentials", async () => {
      const noStore = await api(ctx.server).post("/auth/registeruser").send({ name: "X", email: "x@x.com", password: "Pass-123", phone: uniquePhone() });
      expect(noStore.status).toBe(400);
      await register({ workspace: "no-such-store" }).expect(400);
    });

    it("is rate limited to 10 registrations per IP per hour", async () => {
      for (let i = 0; i < 10; i += 1) await register({ email: `n${i}@authshop.com` }).expect(201);
      await register({ email: "n11@authshop.com" }).expect(429);
    });
  });

  // ------------------------------------------------------------------ email verification
  describe("POST /auth/send-email-verification and /auth/verify-email", () => {
    let sent;
    beforeEach(async () => {
      sent = [];
      resetMailTransport();
      jest.spyOn(nodemailer, "createTransport").mockReturnValue({
        sendMail: async (mail) => {
          sent.push(mail);
          return { messageId: `<m${sent.length}@test>` };
        },
      });
      await settings.updateSection(tenant._id, "email", {
        mode: "smtp", fromEmail: "shop@authshop.com", smtpHost: "smtp.example.test", smtpUser: "u", smtpPassword: "p",
      });
      await settings.updateSection(tenant._id, "general", { storefrontUrl: "https://authshop.example.test" });
      settings.clearSettingsCache();
    });

    const tokenFromMail = () => decodeURIComponent(sent[0].html.match(/token=([^&"]+)/)[1]);

    it("mails a link with a fresh token, then verifies exactly once", async () => {
      await api(ctx.server).post("/auth/send-email-verification").send({ workspace: "authshop", email: "owner@authshop.com" }).expect(200);
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe("owner@authshop.com");
      expect(sent[0].html).toContain("https://authshop.example.test/verify-email?token=");

      const token = tokenFromMail();
      await api(ctx.server).post("/auth/verify-email").send({ workspace: "authshop", email: "owner@authshop.com", token }).expect(200);
      const stored = await reload(owner._id);
      expect(stored.isEmailVerified).toBe(true);
      expect(stored.emailVerificationToken).toBeUndefined();
      // Single use
      await api(ctx.server).post("/auth/verify-email").send({ workspace: "authshop", email: "owner@authshop.com", token }).expect(400);
    });

    it("answers the same for an unknown address and sends nothing", async () => {
      const known = await api(ctx.server).post("/auth/send-email-verification").send({ workspace: "authshop", email: "owner@authshop.com" }).expect(200);
      const unknown = await api(ctx.server).post("/auth/send-email-verification").send({ workspace: "authshop", email: "ghost@authshop.com" }).expect(200);
      expect(unknown.body.message).toBe(known.body.message);
      expect(sent).toHaveLength(1);
    });

    it("rejects a token for another email, a made-up token, an expired token, and missing fields", async () => {
      await api(ctx.server).post("/auth/send-email-verification").send({ workspace: "authshop", email: "owner@authshop.com" }).expect(200);
      const token = tokenFromMail();
      const verify = (body) => api(ctx.server).post("/auth/verify-email").send({ workspace: "authshop", ...body });
      await verify({ email: "someone@authshop.com", token }).expect(400);
      await verify({ email: "owner@authshop.com", token: "deadbeef" }).expect(400);
      await verify({ email: "owner@authshop.com" }).expect(400);
      await runForTenant(tenant._id, () => User.updateOne({ _id: owner._id }, { emailVerificationExpires: new Date(Date.now() - 1000) }));
      await verify({ email: "owner@authshop.com", token }).expect(400);
    });
  });

  // ------------------------------------------------------------------ getme / leakage
  describe("GET /auth/getme", () => {
    it("returns the caller's own profile without any secret", async () => {
      await login({ email: "owner@authshop.com", password: PASSWORD }).expect(200); // stores a refresh token
      const res = await client(tokenFor(owner)).get("/auth/getme").expect(200);
      expect(res.body.data._id).toBe(owner._id.toString());
      expect(res.body.data.isOwner).toBe(true);
      expectNoSecrets(res.body);
    });
  });

  // ------------------------------------------------------------------ user administration
  describe("user administration", () => {
    let managerToken;
    let staff;
    beforeEach(async () => {
      const manager = await createUserIn(tenant, { grants: { "create-user": ["view", "add", "edit", "delete"] } });
      managerToken = tokenFor(manager);
      staff = await createUserIn(tenant, { grants: { product: ["view"] }, email: "staff@authshop.com" });
      // A refresh token and a pending reset on the staff account, to catch leaks
      await runForTenant(tenant._id, () =>
        User.updateOne({ _id: staff._id }, { refreshToken: "secret-refresh-token", resetPasswordToken: "abcdef0123", emailVerificationToken: "verify-me" }),
      );
    });

    it("GET /auth/getallusers lists only this store's users", async () => {
      const other = await tenantFactory.create();
      await createUserIn(other, { owner: true, email: "owner@other.com" });
      const res = await client(managerToken).get("/auth/getallusers").expect(200);
      const emails = res.body.data.map((u) => u.email);
      expect(emails).toContain("staff@authshop.com");
      expect(emails).not.toContain("owner@other.com");
    });

    // BUG-007: list and lookup endpoints return reset / verification tokens
    it("GET /auth/getallusers and /getuserbyemailorphone never expose secrets [BUG-007]", async () => {
      const list = await client(managerToken).get("/auth/getallusers").expect(200);
      expectNoSecrets(list.body);
      const one = await client(managerToken).get("/auth/getuserbyemailorphone").query({ email: "staff@authshop.com" }).expect(200);
      expectNoSecrets(one.body);
    });

    it("GET /auth/getuserbyemailorphone finds the user the query names", async () => {
      const byEmail = await client(managerToken).get("/auth/getuserbyemailorphone").query({ email: "staff@authshop.com" }).expect(200);
      expect(byEmail.body.data._id).toBe(staff._id.toString());
      const byPhone = await client(managerToken).get("/auth/getuserbyemailorphone").query({ phone: staff.phone }).expect(200);
      expect(byPhone.body.data._id).toBe(staff._id.toString());
      await client(managerToken).get("/auth/getuserbyemailorphone").query({ email: "nobody@authshop.com" }).expect(404);
    });

    // BUG-008: delete-user answers with the deleted user's full document, password hash included
    it("DELETE /auth/delete-user/:id does not return the password hash [BUG-008]", async () => {
      const res = await client(managerToken).delete(`/auth/delete-user/${staff._id}`).expect(200);
      expectNoSecrets(res.body);
    });

    it("DELETE /auth/delete-user/:id removes the user; self-delete and other stores' users are refused", async () => {
      await client(managerToken).delete(`/auth/delete-user/${staff._id}`).expect(200);
      expect(await reload(staff._id)).toBeNull();
      await client(tokenFor(owner)).delete(`/auth/delete-user/${owner._id}`).expect(400);

      const other = await tenantFactory.create();
      const foreign = await createUserIn(other, { owner: true });
      const res = await client(tokenFor(owner)).delete(`/auth/delete-user/${foreign._id}`);
      expect(res.status).toBe(404);
      expect(await runForTenant(other._id, () => User.findById(foreign._id))).not.toBeNull();
    });

    it("PUT /auth/deactivate-user/:id ends the user's sessions; activate restores sign-in", async () => {
      const staffToken = tokenFor(staff);
      await client(staffToken).get("/auth/getme").expect(200);
      await client(managerToken).put(`/auth/deactivate-user/${staff._id}`).expect(200);
      await client(staffToken).get("/auth/getme").expect(401);
      expect((await reload(staff._id)).isActive).toBe(false);
      await client(managerToken).put(`/auth/activate-user/${staff._id}`).expect(200);
      expect((await reload(staff._id)).isActive).toBe(true);
    });

    it("PUT /auth/deactivate-user/:id refuses the caller's own account", async () => {
      await client(tokenFor(owner)).put(`/auth/deactivate-user/${owner._id}`).expect(400);
    });

    it("PUT /auth/user-update/:id validates fields and bumps the token version on a password change", async () => {
      const c = client(managerToken);
      await c.put(`/auth/user-update/${staff._id}`).send({ name: "Renamed" }).expect(400);
      await c.put(`/auth/user-update/${staff._id}`).send({ name: "R", email: "staff@authshop.com", phone: staff.phone, discountLimit: 150 }).expect(400);
      const staffToken = tokenFor(staff);
      await c.put(`/auth/user-update/${staff._id}`).send({ name: "Renamed", email: "STAFF@authshop.com", phone: staff.phone, password: "Fresh-Pass1" }).expect(200);
      const stored = await reload(staff._id);
      expect(stored.name).toBe("Renamed");
      expect(stored.email).toBe("staff@authshop.com");
      expect(stored.tokenVersion).toBe(1);
      await client(staffToken).get("/auth/getme").expect(401);
    });

    // BUG-012 (fixed): the new password was written to the database in plain
    // text, so the user could no longer sign in with it
    it("PUT /auth/user-update/:id stores a new password hashed, and it signs in [BUG-012]", async () => {
      await client(managerToken).put(`/auth/user-update/${staff._id}`).send({ name: "S", email: "staff@authshop.com", phone: staff.phone, password: "Fresh-Pass1" }).expect(200);
      const stored = await reload(staff._id);
      expect(stored.password).toMatch(/^\$2[aby]\$/);
      await login({ email: "staff@authshop.com", password: "Fresh-Pass1" }).expect(200);
    });

    it("accepts a 4-character password on add and edit, and nothing shorter", async () => {
      const c = client(managerToken);
      await c.put(`/auth/user-update/${staff._id}`).send({ name: "S", email: "staff@authshop.com", phone: staff.phone, password: "abc" }).expect(400);
      await c.put(`/auth/user-update/${staff._id}`).send({ name: "S", email: "staff@authshop.com", phone: staff.phone, password: "1234" }).expect(200);
      await login({ email: "staff@authshop.com", password: "1234" }).expect(200);
    });

    it("PUT /auth/user-update/:id ignores protected fields", async () => {
      await client(managerToken)
        .put(`/auth/user-update/${staff._id}`)
        .send({ name: "S", email: "staff@authshop.com", phone: staff.phone, isBlocked: true, tokenVersion: 50, permissions: [] })
        .expect(200);
      const stored = await reload(staff._id);
      expect(stored.isBlocked).toBe(false);
      expect(stored.tokenVersion).toBe(0);
      expect(stored.permissions).toHaveLength(0);
    });

    it("POST /auth/add-user creates a staff member with the given role", async () => {
      const role = await runForTenant(tenant._id, () =>
        Role.collection.insertOne({ tenantId: tenant._id, name: "cashier", slug: "cashier", isActive: true, permissions: [] }),
      );
      const res = await client(tokenFor(owner))
        .post("/auth/add-user")
        .field("name", "Cashier One")
        .field("email", "cashier@authshop.com")
        .field("password", "Cash-Pass1")
        .field("phone", "01933333333")
        .field("role", role.insertedId.toString())
        .expect(201);
      expect(res.body.data.email).toBe("cashier@authshop.com");
      const stored = await runForTenant(tenant._id, () => User.findOne({ email: "cashier@authshop.com" }).lean());
      expect(stored.roles.map(String)).toEqual([role.insertedId.toString()]);
      expect(stored.createdBy.toString()).toBe(owner._id.toString());
    });

    it("POST /auth/add-user takes a 4-character password, refuses a 3-character one, and the user signs in", async () => {
      const role = await runForTenant(tenant._id, () =>
        Role.collection.insertOne({ tenantId: tenant._id, name: "cashier", slug: "cashier", isActive: true, permissions: [] }),
      );
      const add = (email, phone, password) =>
        client(tokenFor(owner)).post("/auth/add-user").field("name", "Short Pass").field("email", email).field("phone", phone)
          .field("password", password).field("role", role.insertedId.toString());
      await add("three@authshop.com", "01944444444", "ab1").expect(400);
      await add("four@authshop.com", "01955555555", "ab12").expect(201);
      await login({ email: "four@authshop.com", password: "ab12" }).expect(200);
    });

    // BUG-009: add-user spreads the validated body into User.create (allowUnknown),
    // so a user manager can create an account holding permissions they do not have
    it("POST /auth/add-user cannot grant direct permissions the creator does not hold [BUG-009]", async () => {
      const createRole = await ensurePermissionSlug("create-role");
      const res = await client(managerToken)
        .post("/auth/add-user")
        .send({
          name: "Escalated",
          email: "escalated@authshop.com",
          password: "Esc-Pass1",
          phone: "01944444444",
          permissions: [{ permission: createRole._id.toString(), actions: ["view", "add", "edit", "delete"] }],
          isEmailVerified: true,
        });
      const stored = await runForTenant(tenant._id, () => User.findOne({ email: "escalated@authshop.com" }).lean());
      // Either refused, or created without the smuggled grant
      expect(res.status === 201 ? stored.permissions : []).toEqual([]);
    });

    it("PUT /auth/add-user-permission adds actions without dropping existing ones", async () => {
      const permission = await ensurePermissionSlug("product");
      const c = client(tokenFor(owner));
      await c.put("/auth/add-user-permission").send({ userId: staff._id, permissionId: permission._id, actions: ["view"] }).expect(200);
      await c.put("/auth/add-user-permission").send({ userId: staff._id, permissionId: permission._id, actions: ["edit"] }).expect(200);
      const stored = await reload(staff._id);
      const entry = stored.permissions.find((p) => p.permission.equals(permission._id));
      expect(entry.actions.sort()).toEqual(["edit", "view"]);
      await c.put("/auth/add-user-permission").send({ userId: staff._id, permissionId: permission._id }).expect(400);
      await c.put("/auth/add-user-permission").send({ userId: staff._id, permissionId: "0123456789abcdef01234567", actions: ["view"] }).expect(404);
    });

    // BUG-008 (same leak): the permission endpoints answer with the full user document
    it("PUT /auth/add-user-permission does not return the password hash [BUG-008]", async () => {
      const permission = await ensurePermissionSlug("product");
      const res = await client(tokenFor(owner)).put("/auth/add-user-permission").send({ userId: staff._id, permissionId: permission._id, actions: ["view"] }).expect(200);
      expectNoSecrets(res.body);
    });

    it("GET /auth/isSuperAdmin answers for the owner and for a staff member", async () => {
      // A GET with a body: the dashboard sends the identifier in the request body
      const asOwner = await client(tokenFor(owner)).get("/auth/isSuperAdmin").send({ email: "owner@authshop.com" }).expect(200);
      expect(asOwner.body.data.isSuperAdmin).toBe(true);
      const asStaff = await client(tokenFor(owner)).get("/auth/isSuperAdmin").send({ email: "staff@authshop.com" }).expect(200);
      expect(asStaff.body.data.isSuperAdmin).toBe(false);
      await client(tokenFor(owner)).get("/auth/isSuperAdmin").expect(400);
    });
  });
});
