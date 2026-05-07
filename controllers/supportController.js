const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const SupportTicket = require("../models/SupportTicket");
const Customer = require("../models/Customer");
const { emitSupportConversationUpdate } = require("../socket/supportSocket");

const createGuestChatToken = (conversationId) =>
  jwt.sign(
    { role: "support_guest", convId: String(conversationId) },
    process.env.JWT_SECRET || "restaurant-secret",
    { expiresIn: "7d" }
  );

const verifyGuestChatToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "restaurant-secret");
  if (!decoded || decoded.role !== "support_guest" || !decoded.convId) return null;
  return decoded;
};

const isRecentlyTyping = (dt) => {
  if (!dt) return false;
  return Date.now() - new Date(dt).getTime() <= 4500;
};

const countUnread = (messages, senderRole, lastReadAt) => {
  const last = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return (Array.isArray(messages) ? messages : []).filter(
    (m) => m && m.senderRole === senderRole && new Date(m.createdAt).getTime() > last
  ).length;
};

const pickConversationSummary = (ticket) => {
  const msgs = Array.isArray(ticket.messages) ? ticket.messages : [];
  const last = msgs[msgs.length - 1];
  return {
    _id: ticket._id,
    subject: ticket.subject || "Support Chat",
    status: ticket.status,
    customerName: ticket.customerName || "",
    customerPhone: ticket.customerPhone || "",
    customerEmail: ticket.customerEmail || "",
    customerAccountId: ticket.customerAccountId || null,
    customerProfileImageUrl: ticket.customerProfileImageUrl || "",
    updatedAt: ticket.updatedAt,
    createdAt: ticket.createdAt,
    lastMessage: last ? { text: last.text || "", senderRole: last.senderRole || "customer", createdAt: last.createdAt } : null,
    unreadForCustomer: countUnread(msgs, "admin", ticket.customerLastReadAt),
    unreadForAdmin: countUnread(msgs, "customer", ticket.adminLastReadAt),
    typing: {
      customer: isRecentlyTyping(ticket.customerTypingAt),
      admin: isRecentlyTyping(ticket.adminTypingAt),
    },
  };
};

const customerScopeFilter = (customer) => {
  const customerId = customer?._id || null;
  const phone = String(customer?.phone || "").trim();
  return {
    $or: [
      ...(customerId ? [{ customerAccountId: customerId }] : []),
      ...(phone ? [{ customerPhone: phone }] : []),
    ],
  };
};

const createSupportTicket = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if (!name || !message) {
      return res.status(400).json({ message: "Name and message are required." });
    }

    let customerAccountId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "restaurant-secret");
        if (decoded.role === "customer" && decoded.sub) {
          const customer = await Customer.findById(decoded.sub).select("_id");
          if (customer) customerAccountId = customer._id;
        }
      }
    } catch {
      // Optional auth only; ignore invalid token here.
    }

    const ticket = await SupportTicket.create({
      customerAccountId,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
      subject: subject || "Support Chat",
      messages: [{ senderRole: "customer", text: message }],
      status: "open",
      lastMessageAt: new Date(),
      customerLastReadAt: new Date(),
    });

    const out = { message: "Support ticket submitted.", ticket: pickConversationSummary(ticket) };
    emitSupportConversationUpdate(ticket._id, "support:conversation_updated", {
      conversationId: String(ticket._id),
      conversation: pickConversationSummary(ticket),
    });
    if (!customerAccountId) {
      return res.status(201).json({ ...out, guestToken: createGuestChatToken(ticket._id) });
    }
    return res.status(201).json(out);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to submit support ticket." });
  }
};

const startMySupportConversation = async (req, res) => {
  try {
    const filter = customerScopeFilter(req.customer);
    const existing = await SupportTicket.findOne({
      ...filter,
      status: { $in: ["open", "in_progress"] },
    }).sort({ lastMessageAt: -1 });

    if (existing) {
      return res.status(200).json({ ticket: pickConversationSummary(existing) });
    }

    const c = req.customer;
    const ticket = await SupportTicket.create({
      customerAccountId: c._id,
      customerName: c.name || "Customer",
      customerPhone: String(c.phone || ""),
      customerEmail: String(c.email || ""),
      subject: "Support Chat",
      messages: [],
      status: "open",
      lastMessageAt: new Date(),
      customerLastReadAt: new Date(),
    });

    emitSupportConversationUpdate(ticket._id, "support:conversation_updated", {
      conversationId: String(ticket._id),
      conversation: pickConversationSummary(ticket),
    });
    return res.status(201).json({ ticket: pickConversationSummary(ticket) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to start chat." });
  }
};

const listGuestSupportMessages = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id." });
    }
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "Guest token required." });
    const token = authHeader.split(" ")[1];
    const decoded = verifyGuestChatToken(token);
    if (!decoded || String(decoded.convId) !== conversationId) return res.status(401).json({ message: "Invalid guest token." });
    const ticket = await SupportTicket.findById(conversationId);
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    ticket.customerLastReadAt = new Date();
    ticket.customerTypingAt = null;
    await ticket.save();
    return res.status(200).json({
      conversation: pickConversationSummary(ticket),
      messages: Array.isArray(ticket.messages) ? ticket.messages : [],
      meta: {
        customerLastReadAt: ticket.customerLastReadAt,
        adminLastReadAt: ticket.adminLastReadAt,
        customerTypingAt: ticket.customerTypingAt,
        adminTypingAt: ticket.adminTypingAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load chat." });
  }
};

const sendGuestSupportMessage = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    const text = String(req.body.text || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id." });
    }
    if (!text) return res.status(400).json({ message: "Message text is required." });
    const authHeader = String(req.headers.authorization || "");
    if (!authHeader.startsWith("Bearer ")) return res.status(401).json({ message: "Guest token required." });
    const token = authHeader.split(" ")[1];
    const decoded = verifyGuestChatToken(token);
    if (!decoded || String(decoded.convId) !== conversationId) return res.status(401).json({ message: "Invalid guest token." });

    const ticket = await SupportTicket.findById(conversationId);
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    if (ticket.status === "resolved") {
      return res.status(400).json({ message: "This chat is resolved. Please start a new chat." });
    }
    ticket.messages.push({ senderRole: "customer", text, createdAt: new Date() });
    ticket.lastMessageAt = new Date();
    ticket.customerLastReadAt = new Date();
    await ticket.save();
    emitSupportConversationUpdate(ticket._id, "support:message", {
      conversationId: String(ticket._id),
      message: ticket.messages[ticket.messages.length - 1],
      conversation: pickConversationSummary(ticket),
    });
    return res.status(201).json({ message: "Message sent.", messageItem: ticket.messages[ticket.messages.length - 1] });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to send message." });
  }
};

const listMySupportTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find(customerScopeFilter(req.customer))
      .sort({ lastMessageAt: -1 })
      .limit(100)
      .lean();
    const ids = Array.from(
      new Set(
        (tickets || [])
          .map((t) => (t && t.customerAccountId ? String(t.customerAccountId) : ""))
          .filter(Boolean)
      )
    );
    const customers = ids.length
      ? await Customer.find({ _id: { $in: ids } }).select("_id profileImageUrl").lean()
      : [];
    const avatarMap = (customers || []).reduce((acc, c) => {
      acc[String(c._id)] = String(c.profileImageUrl || "");
      return acc;
    }, {});

    return res.status(200).json({
      tickets: (tickets || []).map((t) => ({
        ...pickConversationSummary(t),
        customerProfileImageUrl: t?.customerAccountId ? avatarMap[String(t.customerAccountId)] || "" : "",
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load tickets." });
  }
};

const listMySupportMessages = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id." });
    }
    const ticket = await SupportTicket.findOne({
      _id: conversationId,
      ...customerScopeFilter(req.customer),
    });
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    ticket.customerLastReadAt = new Date();
    ticket.customerTypingAt = null;
    await ticket.save();
    return res.status(200).json({
      conversation: pickConversationSummary(ticket),
      messages: Array.isArray(ticket.messages) ? ticket.messages : [],
      meta: {
        customerLastReadAt: ticket.customerLastReadAt,
        adminLastReadAt: ticket.adminLastReadAt,
        customerTypingAt: ticket.customerTypingAt,
        adminTypingAt: ticket.adminTypingAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load chat." });
  }
};

const sendMySupportMessage = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    const text = String(req.body.text || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id." });
    }
    if (!text) return res.status(400).json({ message: "Message text is required." });

    const ticket = await SupportTicket.findOne({
      _id: conversationId,
      ...customerScopeFilter(req.customer),
    });
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    if (ticket.status === "resolved") {
      return res.status(400).json({ message: "This chat is resolved. Please start a new chat." });
    }
    ticket.messages.push({ senderRole: "customer", text, createdAt: new Date() });
    ticket.lastMessageAt = new Date();
    ticket.customerLastReadAt = new Date();
    await ticket.save();
    emitSupportConversationUpdate(ticket._id, "support:message", {
      conversationId: String(ticket._id),
      message: ticket.messages[ticket.messages.length - 1],
      conversation: pickConversationSummary(ticket),
    });

    return res.status(201).json({ message: "Message sent.", messageItem: ticket.messages[ticket.messages.length - 1] });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to send message." });
  }
};

const listAdminSupportTickets = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const filter = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            $or: [
              { customerName: { $regex: q, $options: "i" } },
              { customerPhone: { $regex: q, $options: "i" } },
              { customerEmail: { $regex: q, $options: "i" } },
              { subject: { $regex: q, $options: "i" } },
            ],
          }
        : {}),
    };
    const tickets = await SupportTicket.find(filter).sort({ lastMessageAt: -1 }).limit(200).lean();
    const ids = Array.from(
      new Set(
        (tickets || [])
          .map((t) => (t && t.customerAccountId ? String(t.customerAccountId) : ""))
          .filter(Boolean)
      )
    );
    const customers = ids.length
      ? await Customer.find({ _id: { $in: ids } }).select("_id profileImageUrl").lean()
      : [];
    const avatarMap = (customers || []).reduce((acc, c) => {
      acc[String(c._id)] = String(c.profileImageUrl || "");
      return acc;
    }, {});
    return res.status(200).json({
      tickets: (tickets || []).map((t) => ({
        ...pickConversationSummary(t),
        customerProfileImageUrl: t?.customerAccountId ? avatarMap[String(t.customerAccountId)] || "" : "",
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load support conversations." });
  }
};

const listAdminSupportMessages = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id." });
    }
    const ticket = await SupportTicket.findById(conversationId);
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    ticket.adminLastReadAt = new Date();
    ticket.adminTypingAt = null;
    await ticket.save();
    return res.status(200).json({
      conversation: pickConversationSummary(ticket),
      messages: Array.isArray(ticket.messages) ? ticket.messages : [],
      meta: {
        customerLastReadAt: ticket.customerLastReadAt,
        adminLastReadAt: ticket.adminLastReadAt,
        customerTypingAt: ticket.customerTypingAt,
        adminTypingAt: ticket.adminTypingAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load messages." });
  }
};

const sendAdminSupportMessage = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    const text = String(req.body.text || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id." });
    }
    if (!text) return res.status(400).json({ message: "Message text is required." });
    const ticket = await SupportTicket.findById(conversationId);
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    ticket.messages.push({ senderRole: "admin", text, createdAt: new Date() });
    if (ticket.status === "open") ticket.status = "in_progress";
    ticket.lastMessageAt = new Date();
    ticket.adminLastReadAt = new Date();
    await ticket.save();
    emitSupportConversationUpdate(ticket._id, "support:message", {
      conversationId: String(ticket._id),
      message: ticket.messages[ticket.messages.length - 1],
      conversation: pickConversationSummary(ticket),
    });
    return res.status(201).json({ message: "Message sent.", messageItem: ticket.messages[ticket.messages.length - 1] });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to send message." });
  }
};

const setMyTyping = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) return res.status(400).json({ message: "Invalid conversation id." });
    const ticket = await SupportTicket.findOne({ _id: conversationId, ...customerScopeFilter(req.customer) });
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    ticket.customerTypingAt = new Date();
    await ticket.save();
    emitSupportConversationUpdate(ticket._id, "support:typing", {
      conversationId: String(ticket._id),
      senderRole: "customer",
      at: ticket.customerTypingAt,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to set typing." });
  }
};

const setAdminTyping = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) return res.status(400).json({ message: "Invalid conversation id." });
    const ticket = await SupportTicket.findById(conversationId);
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    ticket.adminTypingAt = new Date();
    await ticket.save();
    emitSupportConversationUpdate(ticket._id, "support:typing", {
      conversationId: String(ticket._id),
      senderRole: "admin",
      at: ticket.adminTypingAt,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to set typing." });
  }
};

const updateAdminSupportStatus = async (req, res) => {
  try {
    const conversationId = String(req.params.conversationId || "").trim();
    const status = String(req.body.status || "").trim();
    if (!mongoose.isValidObjectId(conversationId)) {
      return res.status(400).json({ message: "Invalid conversation id." });
    }
    if (!["open", "in_progress", "resolved"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }
    const ticket = await SupportTicket.findById(conversationId);
    if (!ticket) return res.status(404).json({ message: "Conversation not found." });
    ticket.status = status;
    await ticket.save();
    emitSupportConversationUpdate(ticket._id, "support:conversation_updated", {
      conversationId: String(ticket._id),
      conversation: pickConversationSummary(ticket),
    });
    return res.status(200).json({ message: "Status updated.", ticket: pickConversationSummary(ticket) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update status." });
  }
};

module.exports = {
  createSupportTicket,
  startMySupportConversation,
  listMySupportTickets,
  listMySupportMessages,
  sendMySupportMessage,
  listGuestSupportMessages,
  sendGuestSupportMessage,
  listAdminSupportTickets,
  listAdminSupportMessages,
  sendAdminSupportMessage,
  setMyTyping,
  setAdminTyping,
  updateAdminSupportStatus,
};

