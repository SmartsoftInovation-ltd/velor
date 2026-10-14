const mongoose = require("mongoose");
const { connection, cache } = require("../config/redis.config");
const { stopSettingsInvalidationListener } = require("../settings/settings.service");

/**
 * Docker stops a container with SIGTERM and follows with SIGKILL once the stop
 * grace period runs out. Without a handler Node dies on the spot: a BullMQ job
 * is cut off mid-run (an SMS batch half sent, an upload half written) and is
 * only retried after its lock expires.
 *
 * `closeOwn` stops whatever this process serves (the HTTP server, a BullMQ
 * worker) and must wait for in-flight work. The shared connections close after
 * it, because that work still needs them.
 *
 * The forced exit stays below the compose `stop_grace_period` (30s) so the
 * process logs why it gave up instead of being killed silently.
 */
const FORCE_EXIT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 25000;

let shuttingDown = false;

const onShutdown = (name, closeOwn) => {
  const shutdown = async (signal) => {
    // `tini -g` and `concurrently` can both deliver the signal: act on the first
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[${name}] ${signal} received, shutting down`);

    setTimeout(() => {
      console.error(`[${name}] shutdown took longer than ${FORCE_EXIT_MS}ms, forcing exit`);
      process.exit(1);
    }, FORCE_EXIT_MS).unref();

    try {
      await closeOwn();
      await stopSettingsInvalidationListener();
      await mongoose.disconnect();
      await Promise.allSettled([connection.quit(), cache.quit()]);
      console.log(`[${name}] shutdown complete`);
      process.exit(0);
    } catch (err) {
      console.error(`[${name}] shutdown error:`, err.message);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
};

module.exports = { onShutdown };
