const express = require("express");
const multer = require("multer");

const cloudinary = require("../config/cloudinary");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protectAdmin);

router.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ message: "Cloudinary is not configured." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required." });
    }

    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "restaurant",
      resource_type: "image",
    });

    return res.status(200).json({ url: result.secure_url });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to upload image." });
  }
});

module.exports = router;

