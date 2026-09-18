const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

/**
 * One storefront visitor's conversation with a shop.
 *
 * Scoped by the tenancy plugin like any other business record, so a shop's
 * inbox can only ever contain its own conversations — the same guarantee that
 * covers orders and customers, rather than a second mechanism to keep in step.
 *
 * A visitor is identified either by their signed-in account or, far more often,
 * by a guest id their browser holds. Both are recorded so a shopper who signs in
 * mid-conversation keeps their history.
 */
const chatConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    guestId: { type: String, default: null },

    status: { type: String, enum: ["open", "closed"], default: "open", index: true },

    // Denormalised so the inbox can sort and badge without reading every message
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: "", trim: true },
    unreadForStaff: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// The inbox view: this store's conversations, most recently active first
chatConversationSchema.index({ tenantId: 1, lastMessageAt: -1 });
// Finding the conversation a visitor is already in
chatConversationSchema.index({ tenantId: 1, guestId: 1 });

chatConversationSchema.plugin(tenantPlugin);

module.exports =
  mongoose.models.ChatConversation || mongoose.model("ChatConversation", chatConversationSchema);
