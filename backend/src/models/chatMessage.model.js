const mongoose = require("mongoose");
const { tenantPlugin } = require("../tenancy/tenantPlugin");

/**
 * A single message in a storefront conversation.
 *
 * `senderType` is set from the connection the message arrived on, never from
 * the message itself — a visitor able to label their own message "staff" could
 * impersonate the shop inside its own chat window.
 */
const chatMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatConversation",
      required: true,
      index: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 4000 },

    senderType: { type: String, enum: ["guest", "staff"], required: true },
    // The staff member who replied; absent for a visitor's message
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Reading a conversation: newest last, scoped to the store
chatMessageSchema.index({ tenantId: 1, conversation: 1, createdAt: 1 });

chatMessageSchema.plugin(tenantPlugin);

module.exports = mongoose.models.ChatMessage || mongoose.model("ChatMessage", chatMessageSchema);
