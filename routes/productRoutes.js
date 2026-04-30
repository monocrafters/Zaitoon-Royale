const express = require("express");

const {
  getPublicProducts,
  getPublicProductById,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductsMenuOrder,
} = require("../controllers/productController");
const { protectAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/public", getPublicProducts);
router.get("/public/:id", getPublicProductById);

router.use(protectAdmin);

router.get("/", getProducts);
router.get("/:id", getProductById);
router.patch("/menu-order", updateProductsMenuOrder);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

module.exports = router;
