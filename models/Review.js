const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    customerAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, default: "", trim: true },

    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "OrderRequest", required: true, index: true },

    productId: { type: String, default: "", trim: true, index: true },
    productTitle: { type: String, required: true, trim: true, index: true },
    productImageUrl: { type: String, default: "", trim: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    reviewText: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

// Prevent duplicates: same customer should review same order+product only once.
reviewSchema.index({ customerAccountId: 1, orderId: 1, productTitle: 1 }, { unique: true });

module.exports = mongoose.model("Review", reviewSchema);

