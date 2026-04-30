const express = require("express");

const {
  getHeroSlides,
  getPublicHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  reorderHeroSlides,
} = require("../controllers/heroController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/public", getPublicHeroSlides);

router.use(protectAdmin);

router.get("/", getHeroSlides);
router.post("/", createHeroSlide);
router.put("/:id", updateHeroSlide);
router.delete("/:id", deleteHeroSlide);
router.patch("/reorder", reorderHeroSlides);

module.exports = router;

