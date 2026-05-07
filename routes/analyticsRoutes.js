const express = require("express");
const { protectAdmin } = require("../middleware/authMiddleware");
const { getAdminAnalyticsSummary } = require("../controllers/analyticsController");

const router = express.Router();

router.get("/admin/summary", protectAdmin, getAdminAnalyticsSummary);

module.exports = router;
