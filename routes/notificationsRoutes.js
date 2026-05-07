const express = require("express");
const { listAdminNotifications } = require("../controllers/notificationsController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/admin", protectAdmin, listAdminNotifications);

module.exports = router;

