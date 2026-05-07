const express = require("express");
const multer = require("multer");

const {
  checkoutUpsertCustomer,
  getCustomerMe,
  updateCustomerMe,
  uploadCustomerAvatar,
  listAdminCustomers,
  getAdminCustomerById,
} = require("../controllers/customerController");
const { protectAdmin } = require("../middleware/authMiddleware");
const { protectCustomer } = require("../middleware/customerAuthMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/checkout", checkoutUpsertCustomer);
router.get("/me", protectCustomer, getCustomerMe);
router.patch("/me", protectCustomer, updateCustomerMe);
router.post("/me/avatar", protectCustomer, upload.single("image"), uploadCustomerAvatar);
router.get("/admin", protectAdmin, listAdminCustomers);
router.get("/admin/:customerId", protectAdmin, getAdminCustomerById);

module.exports = router;
