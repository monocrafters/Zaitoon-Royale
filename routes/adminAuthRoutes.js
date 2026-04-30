const express = require("express");

const {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
} = require("../controllers/adminAuthController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerAdmin);
router.post("/login", loginAdmin);
router.get("/me", protectAdmin, getAdminProfile);

module.exports = router;
