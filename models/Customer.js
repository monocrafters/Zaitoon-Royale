const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true, index: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    profileImageUrl: { type: String, default: "", trim: true },
    defaultAddress: { type: String, default: "", trim: true },
    defaultCity: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Customer", customerSchema);
