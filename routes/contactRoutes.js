const express = require("express");
const {
  createContactMessage,
  listContactMessagesAdmin,
  updateContactStatusAdmin,
} = require("../controllers/contactController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", createContactMessage);
router.get("/admin", protectAdmin, listContactMessagesAdmin);
router.patch("/admin/:id/status", protectAdmin, updateContactStatusAdmin);

module.exports = router;
