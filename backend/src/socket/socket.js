let io = null;
const { Server } = require("socket.io");
const { customError } = require("../lib/CustomError");

module.exports = {
  initSocket: (server) => {
    io = new Server(server, {
      cors: {
        origin: function (origin, callback) {
          callback(null, true);
        },
        credentials: true,
      },
    });

    // ====== Socket.IO Setup ======
    io.on("connection", (socket) => {
      const userId = socket.handshake.query.userId;
      console.log("User connected socket.handshake.query.userId:", userId);

      if (userId) {
        // Join a room with the userId
        socket.join(userId);
      }

      socket.on("disconnect", () => {
        console.log("User disconnected:", userId);
      });
    });

    io.on("error", (error) => {
      console.error("Socket.IO error:", error);
      throw new customError("Socket.IO error " + error, 500);
    });

    return io;
  },

  getIO: () => {
    if (!io) throw new Error("Socket.io not initialized!");
    return io;
  },
};
