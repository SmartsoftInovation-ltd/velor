const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const Tenant = require("../models/platform/tenant.model");
const { runAsPlatform } = require("../tenancy/context");

const INITIAL_STATUSES = ["provisioning", "active"];

// --name Velor --slug velor --status active  ->  { name, slug, status }
const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
};

/**
 * Creates a tenant record. Idempotent by slug — used to register the existing
 * Velor installation as the first tenant before its data is backfilled.
 */
async function createTenant({ name, slug, status = "provisioning" }) {
  if (!INITIAL_STATUSES.includes(status)) {
    throw new Error(`Initial status must be one of: ${INITIAL_STATUSES.join(", ")}`);
  }

  return runAsPlatform(async () => {
    const existing = await Tenant.findOne({ slug: slug?.trim().toLowerCase() });
    if (existing) {
      console.log(`Tenant "${existing.slug}" already exists (${existing._id}), skipping.`);
      return { created: false, tenant: existing };
    }

    const tenant = await Tenant.create({ name, slug, status, statusChangedAt: new Date() });
    console.log(`Tenant "${tenant.slug}" created: ${tenant._id}`);
    return { created: true, tenant };
  });
}

if (require.main === module) {
  mongoose
    .connect(process.env.DATABASE_URL)
    .then(() => createTenant(parseArgs(process.argv.slice(2))))
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error("Error creating tenant:", err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { createTenant, parseArgs };
