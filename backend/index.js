// module-alias must be registered before any @/ imports
require("module-alias/register");
require("dotenv").config();

const { assertStaffSecrets } = require("./src/config/staffAuth.config");
const { server } = require("./src/app");
const { dbConnect } = require("./src/database/db");
const { customError } = require("./src/lib/CustomError");
const { scheduleTempCleanup } = require("./src/jobs/cleanTempFiles.job");
const { startSettingsInvalidationListener } = require("./src/settings/settings.service");

// Before anything listens: a weak or missing token secret makes every tenant
// boundary forgeable, so in production this exits rather than serving traffic.
assertStaffSecrets();

dbConnect()
  .then(() => {
    scheduleTempCleanup();
    startSettingsInvalidationListener().catch((err) =>
      console.error("Settings invalidation listener failed:", err.message),
    );
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`🌐 Accessible externally via VPS IP at port ${PORT}`);
    });
  })
  .catch((err) => {
    throw new customError("Startup error: " + err, 500);
  });
