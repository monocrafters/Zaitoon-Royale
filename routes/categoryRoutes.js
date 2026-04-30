const express = require("express");

const {
  getCategories,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoriesMenuOrder,
} = require("../controllers/categoryController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

// Public endpoints (for homepage/menu)
router.get("/public", getCategories);
router.get("/public/:id/products", getCategoryProducts);

router.use(protectAdmin);

router.get("/", getCategories);
router.get("/:id/products", getCategoryProducts);
router.patch("/menu-order", updateCategoriesMenuOrder);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

module.exports = router;
