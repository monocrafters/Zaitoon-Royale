const mongoose = require("mongoose");

const heroSlideSchema = new mongoose.Schema(
  {
    kind: {
      type: String,
      enum: ["product", "deal"],
      default: "product",
      required: true,
    },
    // When kind="product"
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    // When kind="deal"
    deal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Deal",
      default: null,
    },
    headline: {
      type: String,
      trim: true,
      default: "",
    },
    subheadline: {
      type: String,
      trim: true,
      default: "",
    },
    badge: {
      type: String,
      trim: true,
      default: "",
    },
    dealEndsAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HeroSlide", heroSlideSchema);

