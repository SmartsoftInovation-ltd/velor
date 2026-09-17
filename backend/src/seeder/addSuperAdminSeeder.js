const Permission = require("../models/permisson.model");
const Role = require("../models/role.model");
const User = require("../models/user.model");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const MIN_PASSWORD_LENGTH = 12;

/**
 * Creates the superadmin account. Credentials are given on the command line and
 * never kept in .env, so the only stored copy is the bcrypt hash in the database:
 *
 *   node src/seeder/addSuperAdminSeeder.js --email you@example.com --password '…'
 *
 * Idempotent — an existing account is left untouched.
 */
async function seedSuperAdmin({ email, password, name = "superadmin" } = {}) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("--email is required");
  }
  if (!password) {
    throw new Error("--password is required");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    );
  }

  const allPermissions = await Permission.find({});
  if (allPermissions.length === 0) {
    throw new Error("No permissions found. Seed permissions first.");
  }

  const roles = await Role.find({ slug: "superadmin" });
  if (roles.length === 0) {
    throw new Error("Superadmin role not found. Seed roles first.");
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    console.log("Superadmin user already exists, skipping.");
    return { created: false, user: existing };
  }

  const superAdmin = new User({
    email: normalizedEmail,
    name,
    password,
    image: null,
    roles: roles.map((role) => role._id),
    permissions: allPermissions.map((permission) => ({
      permission: permission._id,
      actions: ["view", "add", "edit", "delete"],
    })),
    isActive: true,
  });
  superAdmin.createdBy = superAdmin._id;
  await superAdmin.save();

  console.log("Superadmin user created successfully.");
  return { created: true, user: superAdmin };
}

// --email a@b.c --password secret --name "Someone"
const parseArgs = (argv) => {
  const args = {};
  for (const flag of ["email", "password", "name"]) {
    const index = argv.indexOf(`--${flag}`);
    if (index !== -1 && argv[index + 1]) args[flag] = argv[index + 1];
  }
  return args;
};

if (require.main === module) {
  const { email, password, name } = parseArgs(process.argv.slice(2));
  mongoose
    .connect(process.env.DATABASE_URL)
    .then(() => seedSuperAdmin({ email, password, ...(name ? { name } : {}) }))
    .then(() => mongoose.disconnect())
    .catch(async (err) => {
      console.error("Error seeding superadmin:", err.message);
      await mongoose.disconnect();
      process.exit(1);
    });
}

module.exports = { seedSuperAdmin };
