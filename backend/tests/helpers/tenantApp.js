const mongoose = require("mongoose");
const { runForTenant } = require("../../src/tenancy/context");
const Tenant = require("../../src/models/platform/tenant.model");
const Role = require("../../src/models/role.model");
const User = require("../../src/models/user.model");
const Permission = require("../../src/models/permisson.model");

const STAFF_ENV = {
  ACCESS_TOKEN_SECRET: "staff-access-secret-staff-access-secret-0001",
  REFRESH_TOKEN_SCCERET: "staff-refresh-secret-staff-refresh-secret-01",
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
};

const loadApp = () => {
  Object.assign(process.env, STAFF_ENV);
  const { server, io } = require("../../src/app");
  const close = async () => {
    io.close();
    const { connection, cache } = require("../../src/config/redis.config");
    const { stopSettingsInvalidationListener } = require("../../src/settings/settings.service");
    await stopSettingsInvalidationListener();
    await Promise.allSettled([connection.quit(), cache.quit()]);
  };
  return { server, close };
};

const createTenantWithStaff = async ({ slug, status = "active", roleSlug = "superadmin", email = "staff@shop.test", password = "Passw0rd!", permissions = [] }) => {
  const tenant = await Tenant.create({ name: slug, slug, status });
  const user = await runForTenant(tenant._id, async () => {
    const role = await Role.insertMany([{ name: roleSlug, slug: roleSlug, permissions }]);
    return User.create({ name: `${slug} staff`, email, password, phone: `017${Math.floor(10000000 + Math.random() * 89999999)}`, roles: [role[0]._id] });
  });
  return { tenant, user, password };
};

const ensurePermission = (name) =>
  Permission.findOneAndUpdate(
    { permissionName: name },
    { $setOnInsert: { permissionName: name, slug: name.toLowerCase().replace(/\s+/g, "-") } },
    { upsert: true, new: true },
  );

module.exports = { STAFF_ENV, loadApp, createTenantWithStaff, ensurePermission, objectId: () => new mongoose.Types.ObjectId() };
