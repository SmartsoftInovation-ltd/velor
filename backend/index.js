// module-alias must be registered before any @/ imports
require("module-alias/register");
require("dotenv").config();
// Bangladesh time for every date calculation; before anything else runs
require("./src/config/timezone");

const { assertStaffSecrets } = require("./src/config/staffAuth.config");
const { server, io } = require("./src/app");
const { dbConnect } = require("./src/database/db");
const { customError } = require("./src/lib/CustomError");
const { scheduleTempCleanup } = require("./src/jobs/cleanTempFiles.job");
const { scheduleAuditLogPurge } = require("./src/jobs/purgeAuditLogs.job");
const { startSettingsInvalidationListener } = require("./src/settings/settings.service");
const { onShutdown } = require("./src/lib/gracefulShutdown");

// Before anything listens: a weak or missing token secret makes every tenant
// boundary forgeable, so in production this exits rather than serving traffic.
assertStaffSecrets();

dbConnect()
  .then(() => {
    scheduleTempCleanup();
    scheduleAuditLogPurge();
    startSettingsInvalidationListener().catch((err) =>
      console.error("Settings invalidation listener failed:", err.message),
    );
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`🌐 Accessible externally via VPS IP at port ${PORT}`);
    });
    // io.close() disconnects every socket and then closes the HTTP server, which
    // stops new requests and waits for the ones in flight
    onShutdown("api", () => new Promise((resolve) => io.close(() => resolve())));
  })
  .catch((err) => {
    throw new customError("Startup error: " + err, 500);
  });
