"use strict";

require("dotenv").config();
require("module-alias/register");

const { Worker } = require("bullmq");
const { embeddingQueue, EMBEDDING_QUEUE_NAME } = require("@/queues/embedding.queue");
const { connection } = require("@/config/redis.config");
const { dbConnect } = require("@/database/db");
const { embed, productToText, variantToText } = require("@/utils/embedding");

const Product = require("@/models/product.model");
const Variant = require("@/models/variant.model");
// populate("category subcategory brand discount sizeChart") এর জন্য এই মডেলগুলোও mongoose এ
// register হওয়া লাগবে — standalone worker process এ explicit require করা লাগে (backfill.js এর মতো)
require("@/models/category.model");
require("@/models/subcategory.model");
require("@/models/brand.model");
require("@/models/discount.model");
require("@/models/sizeChart.model");

dbConnect()
  .then(() => {
    console.log("✅ Embedding Worker DB connected");
    startEmbeddingWorker();
  })
  .catch((err) => {
    console.error("❌ Embedding Worker DB connection failed:", err.message);
    process.exit(1);
  });

// একটা product কে (populate সহ) নতুন করে embed করে save করে
async function embedProduct(productId) {
  const product = await Product.findById(productId).populate(
    "category subcategory brand variant discount sizeChart",
  );
  if (!product) return { skipped: true, reason: "product not found" };

  product.embedding = await embed(productToText(product));
  await product.save({ validateBeforeSave: false });
  return { productId: product._id.toString() };
}

// একটা variant কে (parent product context সহ) নতুন করে embed করে save করে, এবং যেহেতু
// variant বদলালে parent product এর embed text ও বদলে যায় (multipleVariant এ variant line
// থাকে), তাই parent product কেও re-embed করার জন্য আলাদা job enqueue করা হয়
async function embedVariant(variantId) {
  const variant = await Variant.findById(variantId).populate({
    path: "product",
    populate: "category subcategory brand",
  });
  if (!variant) return { skipped: true, reason: "variant not found" };

  variant.embedding = await embed(variantToText(variant, variant.product));
  await variant.save({ validateBeforeSave: false });

  if (variant.product?._id) {
    await embeddingQueue.add("embed-product", {
      productId: variant.product._id.toString(),
    });
  }

  return { variantId: variant._id.toString() };
}

function startEmbeddingWorker() {
  const worker = new Worker(
    EMBEDDING_QUEUE_NAME,
    async (job) => {
      if (job.name === "embed-product") {
        return embedProduct(job.data.productId);
      }
      if (job.name === "embed-variant") {
        return embedVariant(job.data.variantId);
      }
      return { skipped: true, reason: `unknown job name: ${job.name}` };
    },
    { connection, concurrency: 2 },
  );

  worker.on("ready", () => console.log("✅ Embedding Worker ready"));
  worker.on("active", (job) =>
    console.log(`▶️  Embedding Job active [${job.id}] ${job.name}`),
  );
  worker.on("completed", (job, result) =>
    console.log(`✅ Embedding Job completed [${job.id}] ${job.name}`, result),
  );
  worker.on("failed", (job, err) =>
    console.error(`❌ Embedding Job failed [${job?.id}] ${job?.name}:`, err.message),
  );
  worker.on("error", (err) => console.error("🔥 Embedding Worker error:", err));
}
