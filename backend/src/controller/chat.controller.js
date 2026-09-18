const ChatConversation = require("../models/chatConversation.model");
const ChatMessage = require("../models/chatMessage.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { statusCodes } = require("../constant/constant");

/**
 * The shop's chat inbox.
 *
 * Every query here is tenant-scoped by the plugin, so these handlers never name
 * a store themselves — a conversation id belonging to another shop simply is
 * not found, which is also why "not found" is the right answer rather than
 * "forbidden".
 */

const PAGE_SIZE = 50;

exports.listConversations = asynchandeler(async (req, res) => {
  const conversations = await ChatConversation.find({})
    .sort({ lastMessageAt: -1 })
    .limit(100)
    .populate("user", "name email phone")
    .lean();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Conversations", { conversations });
});

exports.listMessages = asynchandeler(async (req, res) => {
  const conversation = await ChatConversation.findById(req.params.id).lean();
  if (!conversation) throw new customError("Conversation not found", statusCodes.NOT_FOUND);

  const before = req.query.before ? new Date(req.query.before) : null;
  const messages = await ChatMessage.find({
    conversation: conversation._id,
    ...(before ? { createdAt: { $lt: before } } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE)
    .lean();

  // Oldest first for display; the query sorts newest-first only to page
  return apiResponse.sendSuccess(res, statusCodes.OK, "Messages", {
    conversation,
    messages: messages.reverse(),
  });
});

exports.closeConversation = asynchandeler(async (req, res) => {
  const conversation = await ChatConversation.findById(req.params.id);
  if (!conversation) throw new customError("Conversation not found", statusCodes.NOT_FOUND);

  conversation.status = "closed";
  await conversation.save();

  return apiResponse.sendSuccess(res, statusCodes.OK, "Conversation closed", {
    conversation: { _id: conversation._id, status: conversation.status },
  });
});
