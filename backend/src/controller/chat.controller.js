const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");
const { retrieve } = require("../utils/retrieve");
const { generateAnswer } = require("../utils/llm");

// @desc RAG দিয়ে প্রোডাক্ট সংক্রান্ত প্রশ্নের উত্তর দেয়।
// ধাপ ১ (retrieve): প্রশ্নকে vector search দিয়ে সবচেয়ে relevant প্রোডাক্ট খুঁজে বের করা
// ধাপ ২ (generate): সেই প্রোডাক্ট context দিয়ে LLM কে উত্তর জেনারেট করতে বলা
exports.askChat = asynchandeler(async (req, res) => {
  const { question } = req.body;

  if (!question || typeof question !== "string" || !question.trim()) {
    throw new customError("question is required", statusCodes.BAD_REQUEST);
  }

  const trimmedQuestion = question.trim();

  const relevantProducts = await retrieve(trimmedQuestion, 3);
  const answer = await generateAnswer(trimmedQuestion, relevantProducts);

  return apiResponse.sendSuccess(res, statusCodes.OK, "Answer generated", {
    answer,
    sources: relevantProducts.map((p) => ({
      id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      thumbnail: p.thumbnail,
      score: p.score,
    })),
  });
});
