// Usage:
//   npm run migrate -- --tenant velor          move legacy data into a tenant
//   npm run migrate -- --tenant velor --force  re-run every step
//   npm run migrate:cutover                    drop global unique indexes (after migrate)
require("module-alias/register");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();
const { runMigrations, runCutover } = require("./runner");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args[args.indexOf(`--${name}`) + 1];

(async () => {
  await mongoose.connect(process.env.DATABASE_URL, { autoIndex: false });
  try {
    const result = flag("cutover")
      ? await runCutover()
      : await runMigrations({ tenantSlug: value("tenant"), force: flag("force") });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
    try {
      const { connection, cache } = require("../config/redis.config");
      await Promise.allSettled([connection.quit(), cache.quit()]);
    } catch {
      // Redis was never used
    }
  }
})().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
