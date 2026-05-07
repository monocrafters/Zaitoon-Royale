const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["product", "deal"], required: true },
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: "", trim: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderRequestSchema = new mongoose.Schema(
  {
    customerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      address: { type: String, required: true, trim: true },
      city: { type: String, default: "", trim: true },
      notes: { type: String, default: "", trim: true },
    },
    items: { type: [orderItemSchema], default: [] },
    totalItems: { type: Number, required: true, min: 0 },
    totalPayment: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "preparing", "on_the_way", "delivered", "cancelled"],
      default: "pending",
    },
    cancelReason: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrderRequest", orderRequestSchema);

