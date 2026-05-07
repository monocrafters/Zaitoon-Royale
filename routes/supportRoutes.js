const express = require("express");

const {
  createSupportTicket,
  startMySupportConversation,
  listMySupportTickets,
  listMySupportMessages,
  sendMySupportMessage,
  listGuestSupportMessages,
  sendGuestSupportMessage,
  listAdminSupportTickets,
  listAdminSupportMessages,
  sendAdminSupportMessage,
  setMyTyping,
  setAdminTyping,
  updateAdminSupportStatus,
} = require("../controllers/supportController");
const { protectCustomer } = require("../middleware/customerAuthMiddleware");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", createSupportTicket);
router.get("/my", protectCustomer, listMySupportTickets);
router.post("/my/start", protectCustomer, startMySupportConversation);
router.get("/my/:conversationId/messages", protectCustomer, listMySupportMessages);
router.post("/my/:conversationId/messages", protectCustomer, sendMySupportMessage);
router.post("/my/:conversationId/typing", protectCustomer, setMyTyping);
router.get("/guest/:conversationId/messages", listGuestSupportMessages);
router.post("/guest/:conversationId/messages", sendGuestSupportMessage);
router.get("/admin", protectAdmin, listAdminSupportTickets);
router.get("/admin/:conversationId/messages", protectAdmin, listAdminSupportMessages);
router.post("/admin/:conversationId/messages", protectAdmin, sendAdminSupportMessage);
router.post("/admin/:conversationId/typing", protectAdmin, setAdminTyping);
router.patch("/admin/:conversationId/status", protectAdmin, updateAdminSupportStatus);

module.exports = router;

