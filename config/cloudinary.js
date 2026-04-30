const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dpamff9tj",
  api_key: process.env.CLOUDINARY_API_KEY || "394662195492744",
  api_secret: process.env.CLOUDINARY_API_SECRET || "R0YH4igsbIQ6EO8De4BLRVJCksE",
});

module.exports = cloudinary;

