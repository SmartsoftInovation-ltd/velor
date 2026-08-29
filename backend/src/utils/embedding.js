let embedder = null;
let pipelinePromise = null;

// @xenova/transformers একটা pure-ESM প্যাকেজ, কিন্তু এই backend CommonJS (require/module.exports)।
// তাই static import ব্যবহার না করে dynamic import() দিয়ে লোড করা হচ্ছে — এটাই CJS থেকে ESM-only
// প্যাকেজ ব্যবহার করার standard উপায়।
function loadPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = import("@xenova/transformers").then(
      (mod) => mod.pipeline,
    );
  }
  return pipelinePromise;
}

// মডেল একবার লোড হলে আর বারবার লোড হবে না, singleton হিসেবে cache রাখা হচ্ছে
async function getEmbedder() {
  if (!embedder) {
    const pipeline = await loadPipeline();
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

// যেকোনো text কে 384-dimension এর vector এ রূপান্তর করে (RAG সার্চের মূল ফাংশন)
async function embed(text) {
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  return Array.from(output.data); // 384-dim array
}

// category/subcategory/brand/sizeChart populate করা থাকলে object আসে, নাহলে শুধু ObjectId — দুইটাই handle করা হচ্ছে
function refName(ref) {
  if (ref && typeof ref === "object" && ref.name) return ref.name;
  return "";
}

// discount populate করা থাকলে তার নাম আর ভ্যালু (টাকা অথবা %) বের করে টেক্সট বানানোর helper
function discountText(discount) {
  if (!discount || typeof discount !== "object") return "";
  const value =
    discount.discountType === "percentance"
      ? `${discount.discountValueByPercentance || 0}%`
      : `${discount.discountValueByAmount || 0} BDT`;
  return `Discount: ${discount.discountName} (${value})`;
}

// একটা variant subdocument-এর সব গুরুত্বপূর্ণ field (size, color, price, stock, sku ...) দিয়ে একটা লাইন বানানোর helper
function variantLine(v) {
  return [
    v.variantName,
    v.size && v.size !== "N/A" ? `Size: ${v.size}` : "",
    v.color && v.color !== "N/A" ? `Color: ${v.color}` : "",
    `Price: ${v.retailPrice ?? 0} BDT`,
    `Stock: ${v.stockVariant ?? 0}`,
    v.sku ? `SKU: ${v.sku}` : "",
    v.barCode ? `Barcode: ${v.barCode}` : "",
    v.unit ? `Unit: ${v.unit}` : "",
    v.weight ? `Weight: ${v.weight}` : "",
    discountText(v.discount),
  ]
    .filter(Boolean)
    .join(", ");
}

// Product document থেকে embed করার মতো একটা পূর্ণাঙ্গ text বানানোর helper।
// ভালো ফলাফলের জন্য product query তে .populate("category subcategory brand variant discount sizeChart") করে আনা উচিত
function productToText(p) {
  const category = refName(p.category);
  const subcategory = refName(p.subcategory);
  const brand = refName(p.brand);
  const sizeChart = refName(p.sizeChart);
  const tags = Array.isArray(p.tag) && p.tag.length ? p.tag.join(", ") : "";

  // মূল পরিচিতি: নাম, ক্যাটাগরি, সাব-ক্যাটাগরি, ব্র্যান্ড, বর্ণনা, ট্যাগ, স্পেসিফিকেশন
  const base = [
    p.name,
    category && `Category: ${category}`,
    subcategory && `Subcategory: ${subcategory}`,
    brand && `Brand: ${brand}`,
    p.description,
    tags && `Tags: ${tags}`,
    p.specifications && `Specifications: ${p.specifications}`,
  ]
    .filter(Boolean)
    .join(". ");

  // বাড়তি তথ্য: ওজন, মাপ, ওয়ারেন্টি, শিপিং, উৎপত্তি দেশ, রেটিং, ইউনিট, sku/barcode, sizeChart, discount
  const extra = [
    p.manufactureCountry && `Made in: ${p.manufactureCountry}`,
    p.warrantyInformation && `Warranty: ${p.warrantyInformation}`,
    p.shippingInformation && `Shipping: ${p.shippingInformation}`,
    p.rating ? `Rating: ${p.rating}/5` : "",
    p.unit && `Unit: ${p.unit}`,
    p.groupUnit && p.groupUnitQuantity
      ? `Pack: ${p.groupUnitQuantity} ${p.groupUnit}`
      : "",
    p.weight ? `Weight: ${p.weight}` : "",
    p.dimensions &&
    (p.dimensions.width || p.dimensions.height || p.dimensions.depth)
      ? `Dimensions: ${p.dimensions.width}x${p.dimensions.height}x${p.dimensions.depth}`
      : "",
    p.sku && `SKU: ${p.sku}`,
    p.barCode && `Barcode: ${p.barCode}`,
    sizeChart && `Size Chart: ${sizeChart}`,
    discountText(p.discount),
  ]
    .filter(Boolean)
    .join(". ");

  // multipleVariant পণ্যের আসল size/color/price/stock থাকে আলাদা Variant collection-এ, তাই সেগুলো যোগ করা হচ্ছে
  if (
    p.variantType === "multipleVariant" &&
    Array.isArray(p.variant) &&
    p.variant.length
  ) {
    const variantLines = p.variant
      .filter((v) => v && typeof v === "object")
      .map(variantLine)
      .join(" | ");
    return [base, extra, `Available in: ${variantLines}`]
      .filter(Boolean)
      .join(". ")
      .trim();
  }

  // singleVariant পণ্যের size/color/price/stock প্রোডাক্ট ডকুমেন্টেই থাকে
  const size = p.size && p.size !== "N/A" ? `Size: ${p.size}` : "";
  const color = p.color && p.color !== "N/A" ? `Color: ${p.color}` : "";
  const price = `Price: ${p.retailPrice ?? 0} BDT`;
  const stock = `Stock: ${p.stock ?? 0} (${p.availabilityStatus || "In Stock"})`;

  return [base, extra, size, color, price, stock].filter(Boolean).join(". ");
}

// একটা variant কে তার parent product-এর context (নাম/ক্যাটাগরি/ব্র্যান্ড/বর্ণনা) সহ আলাদাভাবে
// embed করার helper — multipleVariant পণ্যে নির্দিষ্ট size/color/stock ধরে সার্চ করতে চাইলে কাজে লাগে
function variantToText(variant, product) {
  const category = refName(product?.category);
  const subcategory = refName(product?.subcategory);
  const brand = refName(product?.brand);

  const base = [
    product?.name,
    category && `Category: ${category}`,
    subcategory && `Subcategory: ${subcategory}`,
    brand && `Brand: ${brand}`,
    product?.description,
  ]
    .filter(Boolean)
    .join(". ");

  return `${base}. ${variantLine(variant)}`.trim();
}

module.exports = { embed, productToText, variantToText };


