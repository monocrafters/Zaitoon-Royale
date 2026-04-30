const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["product", "deal"],
      default: "product",
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      required: false,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    qty: {
      type: Number,
      default: 1,
      min: 1,
    },
    size: {
      type: String,
      enum: ["", "small", "medium", "large", "xlarge"],
      default: "",
    },
    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    cartId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Cart", cartSchema);

