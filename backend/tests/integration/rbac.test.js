const request = require("supertest");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { setPlatformEnv, createPlatformUser } = require("../helpers/platform");
const { loadApp, STAFF_ENV } = require("../helpers/tenantApp");
const { runForTenant, runAsPlatform } = require("../../src/tenancy/context");
const { invalidateTenantCache } = require("../../src/tenancy/tenantResolver");
const { signPlatformAccessToken } = require("../../src/utils/platformTokens");
const { seedTenantRoles } = require("../../src/tenancy/roleTemplate");
const Tenant = require("../../src/models/platform/tenant.model");
const Permission = require("../../src/models/permisson.model");
const Role = require("../../src/models/role.model");
const User = require("../../src/models/user.model");
const service = require("../../src/settings/settings.service");

describe("per-tenant RBAC", () => {
  let app;
  let tenant;
  let perms;
  let roles;
  let ownerToken;
  const envBackup = { ...process.env };

  beforeAll(async () => {
    setSettingsEnv();
    setPlatformEnv();
    await connectTestDb();
    app = loadApp();
    service.setSettingsPublisher(async () => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  const login = async (email, password) => {
    const res = await request(app.server).post("/api/v1/auth/login").send({ workspace: "pizzashop", email, password });
    if (res.status !== 200) throw new Error(`login failed: ${res.status} ${res.body.message}`);
    return res.body.data.accessToken;
  };

  const createStaff = (email, roleIds, permissions = []) =>
    runForTenant(tenant._id, () =>
      User.create({ name: email.split("@")[0], email, password: "Staff-Pass1", phone: `017${String(Math.random()).slice(2, 10)}`, roles: roleIds, permissions }),
    );

  beforeEach(async () => {
    process.env = { ...envBackup, ...STAFF_ENV };
    setSettingsEnv();
    setPlatformEnv();
    invalidateTenantCache();
    service.clearSettingsCache();

    perms = {};
    for (const name of ["Create User", "Create Role", "Product", "Order"]) {
      perms[name] = await Permission.create({ permissionName: name });
    }

    tenant = await Tenant.create({ name: "Pizza", slug: "pizzashop", status: "active", limits: { maxStaff: 4 } });
    roles = await seedTenantRoles(tenant._id);

    await createStaff("owner@pizza.com", [roles.owner._id]);
    ownerToken = await login("owner@pizza.com", "Staff-Pass1");
  });

  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    jest.restoreAllMocks();
    await app.close();
    await disconnectTestDb();
  });

  const auth = (token) => ({ Authorization: `Bearer ${token}` });
  const addUser = (token, body) =>
    request(app.server).post("/api/v1/auth/add-user").set(auth(token))
      .field("name", body.name).field("email", body.email).field("password", "Staff-Pass1")
      .field("phone", body.phone).field("role", String(body.role));

  const grantRole = (role, grants) =>
    runForTenant(tenant._id, () =>
      Role.updateOne({ _id: role._id }, { permissions: grants.map(([name, actions]) => ({ permission: perms[name]._id, actions })) }),
    );

  it("seeds the owner and default staff roles for a tenant", async () => {
    expect(Object.keys(roles).sort()).toEqual(["admin", "manager", "owner", "salesmen"]);
    const list = await runForTenant(tenant._id, () => Role.find().lean());
    expect(list.every((r) => r.tenantId.equals(tenant._id))).toBe(true);
  });

  it("the owner can add staff with any non-owner role", async () => {
    await addUser(ownerToken, { name: "Manager", email: "manager@pizza.com", phone: "01711000001", role: roles.manager._id }).expect(201);
  });

  it("nobody can assign the owner role through the tenant API", async () => {
    const res = await addUser(ownerToken, { name: "Co Owner", email: "co@pizza.com", phone: "01711000002", role: roles.owner._id }).expect(403);
    expect(res.body.message).toMatch(/owner role/i);
  });

  it("enforces the staff limit", async () => {
    await createStaff("s1@pizza.com", [roles.salesmen._id]);
    await createStaff("s2@pizza.com", [roles.salesmen._id]);
    await createStaff("s3@pizza.com", [roles.salesmen._id]);

    const res = await addUser(ownerToken, { name: "Extra", email: "extra@pizza.com", phone: "01711000003", role: roles.salesmen._id }).expect(403);
    expect(res.body.code).toBe("STAFF_LIMIT_REACHED");
  });

  describe("a manager with user management rights", () => {
    let managerToken;

    beforeEach(async () => {
      await grantRole(roles.manager, [["Create User", ["view", "add", "edit"]], ["Product", ["view"]]]);
      await createStaff("manager@pizza.com", [roles.manager._id]);
      managerToken = await login("manager@pizza.com", "Staff-Pass1");
    });

    it("cannot hand out a role with permissions the manager does not hold", async () => {
      await grantRole(roles.salesmen, [["Product", ["view", "add"]]]);
      const res = await addUser(managerToken, { name: "Sales", email: "sales@pizza.com", phone: "01711000004", role: roles.salesmen._id }).expect(403);
      expect(res.body.message).toMatch(/product:add/);

      await grantRole(roles.salesmen, [["Product", ["view"]]]);
      await addUser(managerToken, { name: "Sales", email: "sales@pizza.com", phone: "01711000004", role: roles.salesmen._id }).expect(201);
    });

    it("cannot grant direct permissions beyond their own", async () => {
      const staff = await createStaff("s1@pizza.com", [roles.salesmen._id]);
      await request(app.server).put("/api/v1/auth/add-user-permission").set(auth(managerToken))
        .send({ userId: staff._id, permissionId: perms.Order._id, actions: ["view"] }).expect(403);
      await request(app.server).put(`/api/v1/userpermission/update-user-permissions/${staff._id}`).set(auth(managerToken))
        .send({ permissions: [{ permissionId: perms.Product._id, actions: ["view", "delete"] }] }).expect(403);
      await request(app.server).put(`/api/v1/userpermission/update-user-permissions/${staff._id}`).set(auth(managerToken))
        .send({ permissions: [{ permissionId: perms.Product._id, actions: ["view"] }] }).expect(200);
    });

    it("cannot change or deactivate the owner", async () => {
      const owner = await runForTenant(tenant._id, () => User.findOne({ email: "owner@pizza.com" }));
      await request(app.server).put(`/api/v1/auth/deactivate-user/${owner._id}`).set(auth(managerToken)).expect(403);
      await request(app.server).delete(`/api/v1/auth/delete-user/${owner._id}`).set(auth(managerToken)).expect(403);
    });
  });

  it("deactivating a staff member revokes their sessions immediately", async () => {
    const staff = await createStaff("s1@pizza.com", [roles.salesmen._id]);
    const staffToken = await login("s1@pizza.com", "Staff-Pass1");

    await request(app.server).put(`/api/v1/auth/deactivate-user/${staff._id}`).set(auth(ownerToken)).expect(200);
    await runAsPlatform(() => User.updateOne({ _id: staff._id }, { isActive: true }));

    await request(app.server).get("/api/v1/auth/getme").set(auth(staffToken)).expect(401);
  });

  describe("roles", () => {
    let roleEditorToken;

    beforeEach(async () => {
      await grantRole(roles.admin, [["Create Role", ["view", "add", "edit", "delete"]], ["Product", ["view"]]]);
      await createStaff("admin@pizza.com", [roles.admin._id]);
      roleEditorToken = await login("admin@pizza.com", "Staff-Pass1");
    });

    it("a non-owner cannot assign role permissions beyond their own", async () => {
      await request(app.server).put(`/api/v1/role/${roles.salesmen.slug}/permissions`).set(auth(roleEditorToken))
        .send({ permissions: [{ permissionId: perms.Order._id, actions: ["view"] }] }).expect(403);
      await request(app.server).put(`/api/v1/role/${roles.salesmen.slug}/permissions`).set(auth(roleEditorToken))
        .send({ permissions: [{ permissionId: perms.Product._id, actions: ["view"] }] }).expect(200);
    });

    it("only the owner may change roles that manage users or roles", async () => {
      await grantRole(roles.manager, [["Create User", ["view"]]]);
      await request(app.server).put(`/api/v1/updaterole/${roles.manager.slug}`).set(auth(roleEditorToken)).send({ name: "Store Manager" }).expect(403);
      await request(app.server).put(`/api/v1/updaterole/${roles.manager.slug}`).set(auth(ownerToken)).send({ name: "Store Manager" }).expect(200);
    });

    it("the owner role can be neither edited nor deleted", async () => {
      await request(app.server).put(`/api/v1/updaterole/owner`).set(auth(ownerToken)).send({ name: "boss" }).expect(403);
      await request(app.server).delete(`/api/v1/deleterole/owner`).set(auth(ownerToken)).expect(403);
    });

    it("updateRole ignores permissions in the body", async () => {
      await request(app.server).put(`/api/v1/updaterole/${roles.salesmen.slug}`).set(auth(ownerToken))
        .send({ name: "Sales Team", permissions: [{ permission: perms.Order._id, actions: ["delete"] }] }).expect(200);
      const updated = await runForTenant(tenant._id, () => Role.findById(roles.salesmen._id).lean());
      expect(updated.permissions).toEqual([]);
    });
  });

  describe("permission catalog", () => {
    it("is read-only for tenants", async () => {
      await request(app.server).get("/api/v1/permission/allpermissions").set(auth(ownerToken)).expect(200);
      const res = await request(app.server).post("/api/v1/permission/addpermission").set(auth(ownerToken)).send({ permissionName: "Hack" }).expect(403);
      expect(res.body.message).toMatch(/platform/i);
      await request(app.server).delete(`/api/v1/permission/delete-permission/product`).set(auth(ownerToken)).expect(403);
    });

    it("is managed through the platform API", async () => {
      const platformAuth = { Authorization: `Bearer ${signPlatformAccessToken(await createPlatformUser({ role: "superadmin" }))}` };

      const created = await request(app.server).post("/api/v1/platform/permissions").set(platformAuth).send({ permissionName: "Store Settings" }).expect(201);
      expect(created.body.data.slug).toBe("store-settings");

      const list = await request(app.server).get("/api/v1/platform/permissions").set(platformAuth).expect(200);
      expect(list.body.data.map((p) => p.slug)).toContain("store-settings");

      await request(app.server).patch(`/api/v1/platform/permissions/${created.body.data._id}`).set(platformAuth).send({ isActive: false }).expect(200);
      await request(app.server).delete(`/api/v1/platform/permissions/${created.body.data._id}`).set(platformAuth).expect(200);
    });
  });
});
