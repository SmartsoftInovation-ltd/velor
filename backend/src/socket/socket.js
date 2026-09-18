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
      socket.data = { userId: String(user._id), tenantId: String(tenant._id), staff: user.roles?.length > 0 };
      return next();
    }

    if (tenantSlug && guestId) {
      const tenant = assertTenantActive(await getTenantBySlug(tenantSlug));
      socket.data = { guestId: String(guestId), tenantId: String(tenant._id) };
      return next();
    }

    // No token and no (store, guest id): there is no store to scope this socket to
    return next(unauthorized());
  } catch {
    return next(unauthorized());
  }
};

const joinRooms = (socket) => {
  const { tenantId, userId, guestId, staff } = socket.data || {};
  if (!tenantId) return;

  if (userId) {
    socket.join(userRoom(tenantId, userId));
    if (staff) socket.join(tenantRoom(tenantId));
  } else if (guestId) {
    socket.join(guestRoom(tenantId, guestId));
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

// A missing tenant is a bug in the caller, never a reason to reach every socket:
// io.emit() would put one store's events on every other store's screens. Log and drop.
const missingTenant = (event) => {
  console.error(`[socket] dropped "${event}": no tenant id, refusing to broadcast across stores`);
  return true;
};

// Emit to every staff member of a store
const emitToTenant = (tenantId, event, payload) => {
  if (!io) return;
  if (!tenantId) return void missingTenant(event);
  io.to(tenantRoom(tenantId)).emit(event, payload);
};

const emitToUserOrGuest = (tenantId, { userId, guestId }, event, payload) => {
  if (!io) return;
  if (!tenantId) return void missingTenant(event);
  if (userId) io.to(userRoom(tenantId, userId)).emit(event, payload);
  else if (guestId) io.to(guestRoom(tenantId, guestId)).emit(event, payload);
};

module.exports = { initSocket, getIO, emitToTenant, emitToUserOrGuest };
