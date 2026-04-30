const mongoose = require("mongoose");

const sizePriceSchema = new mongoose.Schema(
  {
    small: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    large: { type: Number, default: 0 },
    xlarge: { type: Number, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    hasSizePricing: {
      type: Boolean,
      default: false,
    },
    sizePrices: {
      type: sizePriceSchema,
      default: () => ({
        small: 0,
        medium: 0,
        large: 0,
        xlarge: 0,
      }),
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    imageUrl: {
      type: String,
      trim: true,
      default: "",
    },
    quantity: {
      type: Number,
      default: 0,
    },
    badge: {
      type: String,
      trim: true,
      default: "",
      enum: [
        "",
        "Trending",
        "Most Ordered",
        "Best Seller",
        "New Arrival",
        "Chef's Special",
        "Limited Deal",
      ],
    },
    menuOrder: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);
