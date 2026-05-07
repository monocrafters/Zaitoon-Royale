const express = require("express");
const { protectCustomer } = require("../middleware/customerAuthMiddleware");
const { protectAdmin } = require("../middleware/authMiddleware");
const {
  listProductReviews,
  listMyPendingReviewItems,
  createMyReview,
  listAdminReviews,
  listLatestPublicReviews,
  listPublicReviewSummaries,
} = require("../controllers/reviewsController");

const router = express.Router();

router.get("/product", listProductReviews);
router.get("/public", listLatestPublicReviews);
router.get("/summary", listPublicReviewSummaries);
router.get("/my/pending", protectCustomer, listMyPendingReviewItems);
router.post("/my", protectCustomer, createMyReview);
router.get("/admin", protectAdmin, listAdminReviews);

module.exports = router;

