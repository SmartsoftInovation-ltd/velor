let io = null;
const { Server } = require("socket.io");
const { corsOrigin } = require("../config/cors.config");
const { getTenantBySlug, assertTenantActive } = require("../tenancy/tenantResolver");

// Rooms: tenant:<id> (staff of a store), tenant:<id>:user:<id>, tenant:<id>:guest:<guestId>
const tenantRoom = (tenantId) => `tenant:${tenantId}`;
const userRoom = (tenantId, userId) => `tenant:${tenantId}:user:${userId}`;
const guestRoom = (tenantId, guestId) => `tenant:${tenantId}:guest:${guestId}`;

const unauthorized = () => new Error("Unauthorized");

// Staff/shoppers authenticate with their access token; guests name the store and their guest id
const authenticate = async (socket, next) => {
  try {
    const { token, tenant: tenantSlug, guestId } = socket.handshake.auth || {};

    if (token) {
      const User = require("../models/user.model");
      const { resolveTokenSession } = require("../middleware/authMiddleware");
      const { user, tenant } = await resolveTokenSession(token, (id) =>
        User.findById(id).select("_id tokenVersion isActive isBlocked roles"),
      );
      if (!user.isActive || user.isBlocked) return next(unauthorized());
      socket.data = { userId: String(user._id), tenantId: tenant ? String(tenant._id) : null, staff: user.roles?.length > 0 };
      return next();
    }

    if (tenantSlug && guestId) {
      const tenant = assertTenantActive(await getTenantBySlug(tenantSlug));
      socket.data = { guestId: String(guestId), tenantId: String(tenant._id) };
      return next();
    }

    if (process.env.TENANCY_MODE === "strict") return next(unauthorized());
    socket.data = { legacy: true };
    return next();
  } catch {
    return next(unauthorized());
  }
};

const joinRooms = (socket) => {
  const { tenantId, userId, guestId, staff, legacy } = socket.data || {};

  if (tenantId && userId) {
    socket.join(userRoom(tenantId, userId));
    if (staff) socket.join(tenantRoom(tenantId));
  } else if (tenantId && guestId) {
    socket.join(guestRoom(tenantId, guestId));
  } else if (legacy && socket.handshake.query.userId) {
    // Pre-multi-tenancy clients (single store only)
    socket.join(String(socket.handshake.query.userId));
  }
};

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: corsOrigin,
      credentials: true,
    },
  });

  io.use(authenticate);
  io.on("connection", joinRooms);
  io.on("error", (error) => console.error("Socket.IO error:", error));

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

// Emit to every staff member of a store; without a tenant (legacy install) to everyone
const emitToTenant = (tenantId, event, payload) => {
  if (!io) return;
  if (tenantId) io.to(tenantRoom(tenantId)).emit(event, payload);
  else io.emit(event, payload);
};

const emitToUserOrGuest = (tenantId, { userId, guestId }, event, payload) => {
  if (!io) return;
  if (!tenantId) {
    io.to(String(userId || guestId)).emit(event, payload);
  } else if (userId) {
    io.to(userRoom(tenantId, userId)).emit(event, payload);
  } else if (guestId) {
    io.to(guestRoom(tenantId, guestId)).emit(event, payload);
  }
};

module.exports = { initSocket, getIO, emitToTenant, emitToUserOrGuest };
