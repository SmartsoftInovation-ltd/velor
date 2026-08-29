const express = require("express");
const _ = express.Router();
const chatController = require("../../controller/chat.controller");
const { authGuard } = require("../../middleware/authMiddleware");

_.route("/chat").post(authGuard, chatController.askChat);

module.exports = _;
