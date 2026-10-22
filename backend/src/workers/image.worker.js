"use strict";

require("dotenv").config();
require("module-alias/register");
require("../config/timezone");

const { Worker } = require("bullmq");
const { tenantJob } = require("@/tenancy/queue");
const { startSettingsInvalidationListener } = require("@/settings/settings.service");
const fs = require("fs/promises");
const { IMAGE_QUEUE_NAME } = require("@/queues/image.queue");
const { connection } = require("@/config/redis.config");
const { queuePrefix } = require("@/queues/prefix");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("@/helpers/cloudinary");
const categoryModel = require("@/models/category.model");
const brandModel = require("@/models/brand.model");
const productModel = require("@/models/product.model");
const discountBannerModel = require("@/models/discountbanner.model");
const variantModel = require("@/models/variant.model");
const bannerModel = require("@/models/banner.model");
const { customerModel } = require("@/models/customer.model");
const userModel = require("@/models/user.model");
const siteInformationModel = require("@/models/siteInformation.model");
const storeInformationModel = require("@/models/storeInformation.model");
const employeeModel = require("@/models/employee.model");
const { bumpNsVersion } = require("@/utils/cache.util");
const { dbConnect } = require("@/database/db");
const { onShutdown } = require("@/lib/gracefulShutdown");

const MODELS = {
  category: categoryModel,
  brand: brandModel,
  product: productModel,
  variant: variantModel,
  customer: customerModel,
  user: userModel,
  banner: bannerModel,
  discountBanner: discountBannerModel,
  siteinformation: siteInformationModel,
  storeinformation: storeInformationModel,
  employee: employeeModel,
};

// Only when run as a process (npm run worker:image); tests require the module
// for its processor without connecting or starting a worker.
if (require.main === module) {
  dbConnect()
    .then(() => {
      startSettingsInvalidationListener().catch((err) =>
        console.error("Settings invalidation listener failed:", err.message),
      );
      console.log("✅ Worker DB connected");
      const worker = startImageWorker();
      // close() waits for the jobs already running before the process exits
      onShutdown("image-worker", () => worker.close());
    })
    .catch((err) => {
      console.error("❌ Worker DB connection failed:", err.message);
      process.exit(1);
    });
}

const processImageJob = async (job) => {
      if (job.name === "delete-cloudinary-image") {
        const { publicId, cloudName } = job.data;
        console.log(`[Worker] Deleting image from Cloudinary: ${publicId}`);
        await deleteCloudinaryFile(publicId, cloudName);
        return { publicId, deleted: true };
      }

      const {
        modelName,
        documentId,
        localPath,
        oldPublicId,
        oldCloudName,
        fieldName = "image",
        index,
      } = job.data;

      const targetField =
        index !== undefined ? `${fieldName}.${index}` : fieldName;

      console.log(
        `[Worker] Processing ${modelName} image upload for ID: ${documentId} (Field: ${targetField})`,
      );

      const Model = MODELS[modelName];
      if (!Model) {
        console.error(`[Worker] Model ${modelName} not found!`);
        throw new Error(`Model ${modelName} not found in worker registry`);
      }

      // Mark as processing so frontend knows upload is in progress
      await Model.updateOne(
        { _id: documentId },
        {
          $set: {
            [`${targetField}.status`]: "processing",
            [`${targetField}.localPath`]: localPath,
            [`${targetField}.tries`]: job.attemptsMade,
          },
        },
      );

      try {
        // deleteAfter: false — worker manages file lifecycle across retries
        const uploaded = await cloudinaryFileUpload(localPath, {
          deleteAfter: false,
        });

        if (!uploaded) {
          throw new Error(
            "Cloudinary upload returned null — file missing or upload failed",
          );
        }

        // Update DB with final image data
        const updateResult = await Model.updateOne(
          { _id: documentId },
          {
            $set: {
              [`${targetField}.url`]: uploaded.optimizeUrl,
              [`${targetField}.publicId`]: uploaded.result.public_id,
              [`${targetField}.cloudName`]: uploaded.cloudName,
              [`${targetField}.status`]: "uploaded",
              [`${targetField}.localPath`]: "",
              [`${targetField}.tries`]: job.attemptsMade + 1,
              [`${targetField}.lastError`]: "",
            },
          },
        );

        console.log(
          `[Worker] DB Update Result for ${modelName}:`,
          updateResult,
        );

        // Delete old Cloudinary image (update case) — non-blocking, non-critical
        if (oldPublicId) {
          deleteCloudinaryFile(oldPublicId, oldCloudName).catch((e) =>
            console.error("[Worker] Old image delete failed:", e.message),
          );
        }

        // Cleanup local temp file
        await fs.unlink(localPath).catch(() => {});

        // Invalidate cache — clients will re-fetch with new image URL
        await bumpNsVersion(modelName);

        return { documentId, imageUrl: uploaded.optimizeUrl };
      } catch (err) {
        await Model.updateOne(
          { _id: documentId },
          {
            $set: {
              [`${targetField}.status`]: "failed",
              [`${targetField}.tries`]: job.attemptsMade + 1,
              [`${targetField}.lastError`]: err?.message || "Upload failed",
            },
          },
        );

        // Cleanup local file once this was the last attempt. attemptsMade counts
        // the attempts before this one, so this one is number attemptsMade + 1;
        // deleting any earlier would leave the remaining retries no file to upload.
        if (job.attemptsMade + 1 >= (job.opts?.attempts ?? 1)) {
          await fs.unlink(localPath).catch(() => {});
        }

        // Re-throw so BullMQ retries according to defaultJobOptions
        throw err;
      }
};

function startImageWorker(options = {}) {
  const worker = new Worker(
    IMAGE_QUEUE_NAME,
    tenantJob(processImageJob),
    { connection, prefix: queuePrefix(), concurrency: 3, ...options },
  );

  worker.on("ready", () => console.log("✅ Image Worker ready"));
  worker.on("active", (job) =>
    console.log(`▶️  Job active  [${job.id}] ${job.name}`),
  );
  worker.on("completed", (job) => console.log(`✅ Job completed [${job.id}]`));
  worker.on("failed", (job, err) =>
    console.error(`❌ Job failed   [${job?.id}]:`, err.message),
  );
  worker.on("error", (err) => console.error("🔥 Worker error:", err));

  return worker;
}

module.exports = { startImageWorker, processImageJob, MODELS };
