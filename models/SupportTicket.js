const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema(
  {
    senderRole: { type: String, enum: ["customer", "admin"], required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    customerAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, default: "", trim: true },
    customerEmail: { type: String, default: "", trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    messages: { type: [supportMessageSchema], default: [] },
    status: { type: String, enum: ["open", "in_progress", "resolved"], default: "open" },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    customerLastReadAt: { type: Date, default: null },
    adminLastReadAt: { type: Date, default: null },
    customerTypingAt: { type: Date, default: null },
    adminTypingAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportTicket", supportTicketSchema);

