const express = require("express");

const {
  getDeals,
  getPublicDeals,
  getPublicDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  reorderDeals,
} = require("../controllers/dealController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/public", getPublicDeals);
router.get("/public/:id", getPublicDealById);

router.use(protectAdmin);

router.get("/", getDeals);
router.post("/", createDeal);
router.put("/:id", updateDeal);
router.delete("/:id", deleteDeal);
router.patch("/reorder", reorderDeals);

module.exports = router;

