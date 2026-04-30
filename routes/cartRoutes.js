const express = require("express");

const {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cartController");

const router = express.Router();

router.get("/:cartId", getCart);
router.post("/:cartId/items", addCartItem);
router.patch("/:cartId/items", updateCartItem);
router.delete("/:cartId/items", removeCartItem);
router.delete("/:cartId/clear", clearCart);

module.exports = router;

