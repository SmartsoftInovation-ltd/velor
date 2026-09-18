const ChatConversation = require("../models/chatConversation.model");
const ChatMessage = require("../models/chatMessage.model");
const { runForTenant } = require("../tenancy/context");

/**
 * Live chat between a storefront visitor and the shop's staff.
 *
 * The one rule that matters here: every read and write runs inside the tenant
 * taken from `socket.data`, which was set during the handshake from an
 * authenticated token or a verified store slug. Nothing in an incoming message
 * payload is allowed to name a store, a conversation's owner, or a sender type.
 * A visitor who could supply those would be able to post into another shop's
 * inbox, or to impersonate the shop replying to themselves.
 *
 * Socket handlers run outside the HTTP middleware chain, so the tenant context
 * is opened explicitly per event rather than inherited.
 */

const MAX_BODY = 4000;

const clean = (body) => (typeof body === "string" ? body.trim().slice(0, MAX_BODY) : "");

/**
 * The visitor's open conversation, created on first message.
 *
 * Looked up by the identity on the socket, so a guest id sent in the payload
 * cannot attach a message to somebody else's thread.
 */
const conversationForVisitor = async ({ userId, guestId }) => {
  const owner = userId ? { user: userId } : { guestId };

  const existing = await ChatConversation.findOne({ ...owner, status: "open" });
  if (existing) return existing;

  return ChatConversation.create({ ...owner, status: "open" });
};

const summarise = (message) => ({
  _id: message._id,
  conversation: message.conversation,
  body: message.body,
  senderType: message.senderType,
  createdAt: message.createdAt,
});

/**
 * Registers the chat events for one connection.
 *
 * Staff and visitors share the event names but not the permissions: a visitor
 * may only write to their own conversation, while staff may reply to any
 * conversation in their store — and the store is fixed by the socket, so "any"
 * still cannot reach another tenant.
 */
const registerChatHandlers = (io, socket, { emitToTenant, emitToUserOrGuest }) => {
  const { tenantId, userId, guestId, staff } = socket.data || {};
  if (!tenantId) return; // a socket with no store has nothing to join

  socket.on("chat:send", async (payload, ack) => {
    const body = clean(payload?.body);
    if (!body) return ack?.({ ok: false, error: "Message is empty" });

    try {
      const result = await runForTenant(tenantId, async () => {
        if (staff) {
          // Staff name the conversation they are replying to. It is fetched
          // inside the tenant scope, so an id from another store finds nothing.
          const conversation = await ChatConversation.findById(payload?.conversationId);
          if (!conversation) return { ok: false, error: "Conversation not found" };

          const message = await ChatMessage.create({
            conversation: conversation._id,
            body,
            senderType: "staff",
            senderId: userId,
          });

          conversation.lastMessageAt = message.createdAt;
          conversation.lastMessagePreview = body.slice(0, 120);
          conversation.unreadForStaff = 0;
          await conversation.save();

          return { ok: true, conversation, message, to: "visitor" };
        }

        const conversation = await conversationForVisitor({ userId, guestId });
        const message = await ChatMessage.create({
          conversation: conversation._id,
          body,
          // Set here, not from the payload: a visitor cannot post as the shop
          senderType: "guest",
          senderId: userId ?? null,
        });

        conversation.lastMessageAt = message.createdAt;
        conversation.lastMessagePreview = body.slice(0, 120);
        conversation.unreadForStaff = (conversation.unreadForStaff ?? 0) + 1;
        await conversation.save();

        return { ok: true, conversation, message, to: "staff" };
      });

      if (!result.ok) return ack?.(result);

      const summary = summarise(result.message);

      if (result.to === "staff") {
        // Reaches this store's staff room only
        emitToTenant(tenantId, "chat:message", {
          ...summary,
          conversationId: String(result.conversation._id),
        });
      } else {
        // Back to the one visitor the conversation belongs to
        emitToUserOrGuest(
          tenantId,
          { userId: result.conversation.user, guestId: result.conversation.guestId },
          "chat:message",
          { ...summary, conversationId: String(result.conversation._id) },
        );
      }

      return ack?.({ ok: true, message: summary, conversationId: String(result.conversation._id) });
    } catch (error) {
      console.error("[chat] failed to save message:", error.message);
      return ack?.({ ok: false, error: "Could not send the message" });
    }
  });

  // Staff marking a conversation read; a visitor has nothing to mark
  socket.on("chat:read", async (payload, ack) => {
    if (!staff) return ack?.({ ok: false, error: "Not allowed" });

    try {
      await runForTenant(tenantId, async () => {
        const conversation = await ChatConversation.findById(payload?.conversationId);
        if (!conversation) return;
        conversation.unreadForStaff = 0;
        await conversation.save();
        await ChatMessage.updateMany(
          { conversation: conversation._id, senderType: "guest", readAt: null },
          { $set: { readAt: new Date() } },
        );
      });
      return ack?.({ ok: true });
    } catch (error) {
      console.error("[chat] failed to mark read:", error.message);
      return ack?.({ ok: false });
    }
  });

  // Transient, never stored: it is only a hint for the other side's UI
  socket.on("chat:typing", (payload) => {
    if (staff) {
      emitToUserOrGuest(
        tenantId,
        { userId: payload?.userId, guestId: payload?.guestId },
        "chat:typing",
        { conversationId: payload?.conversationId, from: "staff" },
      );
    } else {
      emitToTenant(tenantId, "chat:typing", { guestId, userId, from: "visitor" });
    }
  });
};

module.exports = { registerChatHandlers };
