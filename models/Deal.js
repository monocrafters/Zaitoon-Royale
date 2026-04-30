const mongoose = require("mongoose");

const dealItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, default: 1, min: 1 },
    size: {
      type: String,
      enum: ["", "small", "medium", "large", "xlarge"],
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const dealSchema = new mongoose.Schema(
  {
    // New format (supports quantities)
    items: { type: [dealItemSchema], default: undefined },

    // Legacy format (kept for backward compatibility)
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
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

    // pricing/discount
    discountType: {
      type: String,
      enum: ["percent", "flat", "none"],
      default: "percent",
      required: true,
    },
    discountValue: { type: Number, default: 0 },
    couponCode: { type: String, trim: true, default: "" },

    // media
    imageUrl: { type: String, trim: true, default: "" },

    // schedule
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },

    // display
    theme: {
      type: String,
      enum: ["warm", "dark", "green", "purple", "blue"],
      default: "warm",
    },
    ctaLabel: { type: String, trim: true, default: "See Deal" },
    ctaHref: { type: String, trim: true, default: "#offers" },

    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 1, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Deal", dealSchema);

