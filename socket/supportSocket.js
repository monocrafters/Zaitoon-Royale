const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const Admin = require("../models/Admin");
const Customer = require("../models/Customer");
const SupportTicket = require("../models/SupportTicket");

let io = null;

const jwtSecret = process.env.JWT_SECRET || "restaurant-secret";

const verifyConversationAccess = async (conversationId, auth = {}) => {
  if (!mongoose.isValidObjectId(conversationId)) return null;

  const role = String(auth.role || "");
  const token = String(auth.token || "");
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (role === "admin") {
      if (!decoded?.id) return null;
      const admin = await Admin.findById(decoded.id).select("_id").lean();
      if (!admin) return null;
      return { role: "admin", room: `support:${conversationId}` };
    }

    if (role === "customer") {
      if (decoded?.role !== "customer" || !decoded?.sub) return null;
      const customer = await Customer.findById(decoded.sub).lean();
      if (!customer) return null;
      const filter = {
        _id: conversationId,
        $or: [
          { customerAccountId: customer._id },
          ...(customer.phone ? [{ customerPhone: String(customer.phone).trim() }] : []),
        ],
      };
      const ticket = await SupportTicket.findOne(filter).select("_id").lean();
      if (!ticket) return null;
      return { role: "customer", room: `support:${conversationId}` };
    }

    if (role === "guest") {
      if (decoded?.role !== "support_guest" || String(decoded?.convId || "") !== conversationId) return null;
      return { role: "guest", room: `support:${conversationId}` };
    }
  } catch {
    return null;
  }

  return null;
};

const initSupportSocketServer = (server, clientUrl) => {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        // Allow local/dev origins so realtime works across localhost/LAN previews.
        if (!origin) return callback(null, true);
        const allowed = new Set([
          String(clientUrl || ""),
          "http://localhost:3000",
          "http://127.0.0.1:3000",
        ]);
        if (allowed.has(origin)) return callback(null, true);
        return callback(null, true);
      },
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("support:join", async (payload = {}, ack) => {
      const conversationId = String(payload.conversationId || "");
      const access = await verifyConversationAccess(conversationId, payload.auth || {});
      if (!access) {
        if (typeof ack === "function") ack({ ok: false, message: "Unauthorized" });
        return;
      }
      socket.join(access.room);
      if (typeof ack === "function") ack({ ok: true });
    });

    socket.on("support:leave", (payload = {}) => {
      const conversationId = String(payload.conversationId || "");
      if (!conversationId) return;
      socket.leave(`support:${conversationId}`);
    });
  });

  return io;
};

const emitSupportConversationUpdate = (conversationId, event, payload = {}) => {
  if (!io || !conversationId) return;
  io.to(`support:${String(conversationId)}`).emit(event, payload);
};

module.exports = {
  initSupportSocketServer,
  emitSupportConversationUpdate,
};
