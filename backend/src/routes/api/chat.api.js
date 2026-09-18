const express = require("express");
const chatController = require("../../controller/chat.controller");
const { authGuard } = require("../../middleware/authMiddleware");
const { authorize } = require("../../middleware/checkPermission.middleware");

/**
 * The shop's chat inbox, read from the dashboard.
 *
 * Staff only: visitors send and receive over their socket, which is scoped to
 * their own conversation. Everything here is tenant-scoped by the plugin.
 */
const _ = express.Router();

_.get("/conversations", authGuard, authorize("chat", "view"), chatController.listConversations);
_.get("/conversations/:id/messages", authGuard, authorize("chat", "view"), chatController.listMessages);
_.post("/conversations/:id/close", authGuard, authorize("chat", "edit"), chatController.closeConversation);

module.exports = _;
