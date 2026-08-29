const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
// populate("category subcategory brand discount sizeChart") এর জন্য এই মডেলগুলোও
// mongoose এ register হওয়া লাগবে — মূল app এ অন্য route file load হওয়ার সময় এমনিতেই
// register হয়ে যায়, কিন্তু standalone script এ explicit require করা লাগে
require("../models/category.model");
require("../models/subcategory.model");
require("../models/brand.model");
require("../models/discount.model");
require("../models/sizeChart.model");
const { embed, productToText, variantToText } = require("../utils/embedding");

// এখনো embedding নেই এমন সব product খুঁজে বের করে, populate করে (যাতে category/brand/variant
// এর নাম text এ যায়, শুধু ObjectId না), তারপর একটা একটা করে embed করে save করে
async function backfillProducts() {
  const products = await Product.find({ embedding: { $exists: false } }).populate(
    "category subcategory brand variant discount sizeChart",
  );

  console.log(`Found ${products.length} products to embed`);

  for (const p of products) {
    try {
      const vector = await embed(productToText(p));
      p.embedding = vector;
      await p.save();
      console.log(`✔  Embedded product: ${p.name}`);
    } catch (error) {
      console.error(`❌  Failed product: ${p.name} — ${error.message}`);
    }
  }
}

// এখনো embedding নেই এমন সব variant খুঁজে বের করে, প্রতিটার সাথে তার parent product
// (নাম/ক্যাটাগরি/ব্র্যান্ড context এর জন্য) populate করে variantToText দিয়ে embed করে save করে
async function backfillVariants() {
  const variants = await Variant.find({ embedding: { $exists: false } }).populate({
    path: "product",
    populate: "category subcategory brand",
  });

  console.log(`Found ${variants.length} variants to embed`);

  for (const v of variants) {
    try {
      const vector = await embed(variantToText(v, v.product));
      v.embedding = vector;
      await v.save();
      console.log(`✔  Embedded variant: ${v.variantName || v._id}`);
    } catch (error) {
      console.error(
        `❌  Failed variant: ${v.variantName || v._id} — ${error.message}`,
      );
    }
  }
}

async function backfill() {
  await backfillProducts();
  await backfillVariants();
  console.log("🎉 Backfill complete");
}

mongoose
  .connect(process.env.DATABASE_URL)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    return backfill();
  })
  .then(() => {
    mongoose.disconnect();
    console.log("🔌 MongoDB disconnected.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });
