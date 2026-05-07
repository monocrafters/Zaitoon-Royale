const RestaurantSettings = require("../models/RestaurantSettings");

const SETTINGS_KEY = "main";

const ensureSettings = async () => {
  let doc = await RestaurantSettings.findOne({ key: SETTINGS_KEY });
  if (!doc) {
    doc = await RestaurantSettings.create({ key: SETTINGS_KEY });
  }
  return doc;
};

const toPublicPayload = (doc) => ({
  brandName: doc.brandName || "Zaitoon Royale",
  tagline: doc.tagline || "Lahori Fine Dining",
  adminLogoUrl: doc.adminLogoUrl || "",
  whatsappNumber: doc.whatsappNumber || "",
  contactPhone: doc.contactPhone || "",
  contactEmail: doc.contactEmail || "",
  contactHours: doc.contactHours || "",
  contactAddress: doc.contactAddress || "",
  mapEmbedUrl: doc.mapEmbedUrl || "",
  socialLinks: {
    instagram: doc.socialLinks?.instagram || "",
    youtube: doc.socialLinks?.youtube || "",
    tiktok: doc.socialLinks?.tiktok || "",
    facebook: doc.socialLinks?.facebook || "",
  },
});

const getPublicSettings = async (_req, res) => {
  try {
    const doc = await ensureSettings();
    return res.status(200).json({ settings: toPublicPayload(doc) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load settings." });
  }
};

const getAdminSettings = async (_req, res) => {
  try {
    const doc = await ensureSettings();
    return res.status(200).json({ settings: toPublicPayload(doc) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load settings." });
  }
};

const updateAdminSettings = async (req, res) => {
  try {
    const doc = await ensureSettings();
    const body = req.body || {};
    const assign = (key) => {
      if (typeof body[key] === "string") doc[key] = body[key].trim();
    };
    assign("brandName");
    assign("tagline");
    assign("adminLogoUrl");
    assign("whatsappNumber");
    assign("contactPhone");
    assign("contactEmail");
    assign("contactHours");
    assign("contactAddress");
    assign("mapEmbedUrl");

    if (body.socialLinks && typeof body.socialLinks === "object") {
      const sl = body.socialLinks;
      doc.socialLinks = {
        instagram: typeof sl.instagram === "string" ? sl.instagram.trim() : doc.socialLinks?.instagram || "",
        youtube: typeof sl.youtube === "string" ? sl.youtube.trim() : doc.socialLinks?.youtube || "",
        tiktok: typeof sl.tiktok === "string" ? sl.tiktok.trim() : doc.socialLinks?.tiktok || "",
        facebook: typeof sl.facebook === "string" ? sl.facebook.trim() : doc.socialLinks?.facebook || "",
      };
    }

    await doc.save();
    return res.status(200).json({ message: "Settings updated.", settings: toPublicPayload(doc) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update settings." });
  }
};

module.exports = {
  getPublicSettings,
  getAdminSettings,
  updateAdminSettings,
};
