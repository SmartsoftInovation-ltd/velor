"use strict";

require("dotenv").config();
require("module-alias/register");
require("../config/timezone");

const { Worker } = require("bullmq");
const { tenantJob } = require("@/tenancy/queue");
const { startSettingsInvalidationListener } = require("@/settings/settings.service");
const { EMAIL_QUEUE_NAME } = require("@/queues/email.queue");
const { connection } = require("@/config/redis.config");
const { queuePrefix } = require("@/queues/prefix");
const { sendEmail } = require("@/helpers/nodemailer");
const { dbConnect } = require("@/database/db");
const { onShutdown } = require("@/lib/gracefulShutdown");

// Only when run as a process (npm run worker:email); tests require the module
// for its processor without connecting or starting a worker.
if (require.main === module) {
  dbConnect()
    .then(() => {
      startSettingsInvalidationListener().catch((err) =>
        console.error("Settings invalidation listener failed:", err.message),
      );
      console.log("✅ Email Worker DB connected");
      const worker = startEmailWorker();
      // close() waits for the jobs already running before the process exits
      onShutdown("email-worker", () => worker.close());
    })
    .catch((err) => {
      console.error("❌ Email Worker DB connection failed:", err.message);
      process.exit(1);
    });
}

const processEmailJob = async (job) => {
  const { to, subject, html } = job.data;
  if (!to) {
    // Nothing to send — treat as a no-op success so the job doesn't retry.
    return { skipped: true, reason: "no recipient" };
  }
  // An SMTP failure throws, so the queue's attempts and backoff retry it and
  // a mail that never went out ends "failed" (it used to "complete" as null).
  // A store with email turned off is not a failure: nothing will ever send.
  try {
    const messageId = await sendEmail(to, subject, html, { throwOnError: true });
    return { to, messageId: messageId || null };
  } catch (error) {
    if (error?.code === "EMAIL_NOT_CONFIGURED") {
      return { skipped: true, reason: "email not configured" };
    }
    throw error;
  }
};

function startEmailWorker(options = {}) {
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    tenantJob(processEmailJob),
    { connection, prefix: queuePrefix(), concurrency: 3, ...options },
  );

  worker.on("ready", () => console.log("✅ Email Worker ready"));
  worker.on("active", (job) => console.log(`▶️  Email Job active [${job.id}]`));
  worker.on("completed", (job, result) =>
    console.log(`✅ Email Job completed [${job.id}] — to:${result?.to || "-"}`),
  );
  worker.on("failed", (job, err) =>
    console.error(`❌ Email Job failed [${job?.id}]:`, err.message),
  );
  worker.on("error", (err) => console.error("🔥 Email Worker error:", err));

  return worker;
}

module.exports = { startEmailWorker, processEmailJob };
