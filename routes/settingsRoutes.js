const express = require("express");
const { protectAdmin } = require("../middleware/authMiddleware");
const {
  getPublicSettings,
  getAdminSettings,
  updateAdminSettings,
} = require("../controllers/settingsController");

const router = express.Router();

router.get("/public", getPublicSettings);
router.get("/admin", protectAdmin, getAdminSettings);
router.patch("/admin", protectAdmin, updateAdminSettings);

module.exports = router;
