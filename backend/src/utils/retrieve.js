const Product = require("../models/product.model");
const { embed } = require("./embedding");

// ইউজারের প্রশ্নকে embed করে Atlas Vector Search ("vector_index") দিয়ে সবচেয়ে relevant
// প্রোডাক্টগুলো খুঁজে বের করে — এটাই RAG এর "retrieval" অংশ
async function retrieve(query, topK = 3) {
  const queryEmbedding = await embed(query);

  const results = await Product.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        // numCandidates যত বেশি, ফলাফল তত ভালো হয় কিন্তু স্লো — topK এর ~20x একটা reasonable trade-off
        numCandidates: Math.max(topK * 20, 100),
        limit: topK,
      },
    },
    // ইনঅ্যাক্টিভ প্রোডাক্ট বাদ দেওয়া হচ্ছে। vector index এ filter field সেট করা নেই,
    // তাই $vectorSearch এর filter অপশন না ব্যবহার করে সাধারণ post-match ব্যবহার করা হচ্ছে
    { $match: { isActive: true } },
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "categoryDoc",
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "brand",
        foreignField: "_id",
        as: "brandDoc",
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        slug: 1,
        description: 1,
        price: "$retailPrice",
        stock: 1,
        availabilityStatus: 1,
        category: { $ifNull: [{ $arrayElemAt: ["$categoryDoc.name", 0] }, ""] },
        brand: { $ifNull: [{ $arrayElemAt: ["$brandDoc.name", 0] }, ""] },
        thumbnail: "$thumbnail.url",
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return results;
}

module.exports = { retrieve };
