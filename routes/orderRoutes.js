const express = require("express");

const {
  createOrderRequest,
  listMyOrders,
  getMyOrderById,
  listAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
} = require("../controllers/orderController");
const { protectAdmin } = require("../middleware/authMiddleware");
const { protectCustomer } = require("../middleware/customerAuthMiddleware");

const router = express.Router();

router.get("/admin/:orderId", protectAdmin, getAdminOrderById);
router.patch("/admin/:orderId/status", protectAdmin, updateAdminOrderStatus);
router.get("/admin", protectAdmin, listAdminOrders);
router.get("/my/:orderId", protectCustomer, getMyOrderById);
router.get("/my", protectCustomer, listMyOrders);
router.post("/", createOrderRequest);

module.exports = router;

