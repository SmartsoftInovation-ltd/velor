require("dotenv").config();
require("module-alias/register");
const mongoose = require("mongoose");
const Role = require("../models/role.model");
const Permission = require("../models/permisson.model");
const Tenant = require("../models/platform/tenant.model");
const { runForTenant } = require("../tenancy/context");

// Grants the report permissions added after the base seed (customer reports,
// top customer and supplier ledger).
//
// Deliberately additive, unlike rolePermissionSeeder.js which does
// `role.permissions = assignments` — a full replace. Several roles in the
// database already hold more permissions than that seeder declares (admin has
// 64 against the seeder's list, cashier has 28 and no block at all), so running
// the full seeder to pick up four new entries would silently strip the rest.
// This script only ever adds, and skips a role that already has the grant.
const PERMISSION_NAMES = [
  "Customer Payment Report",
  "Customer Balance Summary Report",
  "Customer Ledger Report",
  "Customer Due List Report",
  "Customer Invoice Profit Report",
  "Invoice Profit Report",
  "Product Profit Report",
  "Top Sales Product Report",
  "Push Sales Product Report",
  "Product Sales Return Report",
  "Top Customer Report",
  "Supplier Ledger Report",
  "Supplier Balance Summary Report",
  "Supplier Dues Report",
  "All Transaction Summary",
  "Accounts Ledger",
  "Account Day Transaction",
];

const TARGET_ROLE_SLUGS = ["admin", "manager", "salesman"];

const ACTIONS = ["view"];

async function grantCustomerReportPermissions({ dryRun = false } = {}) {
  // 1) Make sure each permission document exists.
  const permissions = [];
  for (const permissionName of PERMISSION_NAMES) {
    let perm = await Permission.findOne({ permissionName });
    if (!perm) {
      if (dryRun) {
        console.log(`  would create permission: "${permissionName}"`);
        continue;
      }
      // save() rather than insertMany so the slug pre-save hook runs.
      perm = await new Permission({ permissionName }).save();
      console.log(`  created permission: "${permissionName}" (${perm.slug})`);
    }
    permissions.push(perm);
  }

  if (dryRun && permissions.length !== PERMISSION_NAMES.length) {
    console.log("\n  (dry run: role grants below assume the above were created)");
  }

  // 2) Add the grant to each target role in every store. Permissions are a
  // shared catalogue, but roles belong to a tenant, so role lookups must run
  // inside that tenant's context (strict mode throws without one).
  let rolesTouched = 0;
  const tenants = await Tenant.find().select("_id slug").lean();
  for (const tenant of tenants) {
    console.log(`\n  [${tenant.slug}]`);
    rolesTouched += await runForTenant(tenant._id, () =>
      grantToRoles(permissions, { dryRun }),
    );
  }

  return { permissions: permissions.length, tenants: tenants.length, rolesTouched };
}

async function grantToRoles(permissions, { dryRun }) {
  let rolesTouched = 0;
  for (const slug of TARGET_ROLE_SLUGS) {
    const role = await Role.findOne({ slug });
    if (!role) {
      console.log(`  role not found: ${slug} — skipping`);
      continue;
    }

    const existingIds = new Set(
      (role.permissions || []).map((p) => String(p.permission)),
    );

    const added = [];
    for (const perm of permissions) {
      if (existingIds.has(String(perm._id))) continue;
      added.push(perm.permissionName);
      if (!dryRun) {
        role.permissions.push({ permission: perm._id, actions: ACTIONS });
      }
    }

    if (permissions.length === 0) {
      console.log(`  ${slug}: nothing to grant yet (permissions not created)`);
      continue;
    }

    if (added.length === 0) {
      console.log(`  ${slug}: already has all ${permissions.length} — no change`);
      continue;
    }

    if (dryRun) {
      console.log(`  would grant ${slug}: ${added.join(", ")}`);
    } else {
      await role.save();
      console.log(
        `  ${slug}: granted ${added.length} (now ${role.permissions.length} total)`,
      );
    }
    rolesTouched++;
  }

  return rolesTouched;
}

module.exports = { grantCustomerReportPermissions };

if (require.main === module) {
  (async () => {
    const dryRun = process.argv.includes("--dry");

    try {
      await mongoose.connect(process.env.DATABASE_URL);
      console.log(`Connected.${dryRun ? " DRY RUN — no writes." : ""}\n`);

      const { permissions, tenants, rolesTouched } = await grantCustomerReportPermissions({
        dryRun,
      });

      console.log(
        dryRun
          ? `\nDry run complete. Re-run without --dry to apply.`
          : `\nDone. permissions=${permissions} tenants=${tenants} rolesUpdated=${rolesTouched}`,
      );
    } catch (err) {
      console.error("Grant failed:", err.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
