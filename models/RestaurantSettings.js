const mongoose = require("mongoose");

const restaurantSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "main" },
    brandName: { type: String, default: "Zaitoon Royale", trim: true },
    tagline: { type: String, default: "Lahori Fine Dining", trim: true },
    adminLogoUrl: { type: String, default: "", trim: true },
    whatsappNumber: { type: String, default: "+923313269415", trim: true },
    contactPhone: { type: String, default: "+92 3313269415", trim: true },
    contactEmail: { type: String, default: "hello@zaitoonroyale.com", trim: true, lowercase: true },
    contactHours: { type: String, default: "Daily: 11:00 AM - 12:00 AM", trim: true },
    contactAddress: { type: String, default: "Food Street, Lahore, Pakistan", trim: true },
    mapEmbedUrl: { type: String, default: "https://www.google.com/maps?q=MM+Alam+Road+Lahore&output=embed", trim: true },
    socialLinks: {
      instagram: { type: String, default: "", trim: true },
      youtube: { type: String, default: "", trim: true },
      tiktok: { type: String, default: "", trim: true },
      facebook: { type: String, default: "", trim: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RestaurantSettings", restaurantSettingsSchema);
