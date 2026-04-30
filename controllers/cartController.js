const mongoose = require("mongoose");

const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Deal = require("../models/Deal");

const allowedSizes = new Set(["", "small", "medium", "large", "xlarge"]);

const normalizeSize = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  return allowedSizes.has(raw) ? raw : "";
};

const unitPrice = (productDoc, size) => {
  const base = Number(productDoc?.price) || 0;
  if (!productDoc?.hasSizePricing) return base;
  const selected = normalizeSize(size) || "medium";
  const v = Number(productDoc?.sizePrices?.[selected]) || 0;
  if (v > 0) return v;
  const mid = Number(productDoc?.sizePrices?.medium) || 0;
  return mid > 0 ? mid : base;
};

const computeDealFinalPrice = (dealDoc) => {
  const pricingFinal = Number(dealDoc?.pricing?.finalPrice) || 0;
  if (pricingFinal > 0) return pricingFinal;

  const items = Array.isArray(dealDoc?.items) ? dealDoc.items : [];
  if (items.length) {
    const original = items.reduce((sum, it) => {
      const qty = Math.max(1, Number(it?.qty) || 1);
      const p = it?.product;
      if (!p) return sum;
      if (!p.hasSizePricing) return sum + (Number(p.price) || 0) * qty;
      const pick = (k) => Number(p?.sizePrices?.[k]) || 0;
      const size = normalizeSize(it?.size) || "medium";
      const selected = pick(size);
      const mid = pick("medium");
      const base = Number(p.price) || 0;
      const u = selected > 0 ? selected : mid > 0 ? mid : base;
      return sum + u * qty;
    }, 0);
    const discountType = String(dealDoc?.discountType || "none");
    const discountValue = Math.max(0, Number(dealDoc?.discountValue) || 0);
    if (discountType === "percent") {
      return Math.max(0, Math.round(original - (original * discountValue) / 100));
    }
    if (discountType === "flat") {
      return Math.max(0, Math.round(original - discountValue));
    }
    return original;
  }

  const legacy = Array.isArray(dealDoc?.products) ? dealDoc.products : [];
  if (legacy.length) {
    const original = legacy.reduce((sum, p) => sum + (Number(p?.price) || 0), 0);
    const discountType = String(dealDoc?.discountType || "none");
    const discountValue = Math.max(0, Number(dealDoc?.discountValue) || 0);
    if (discountType === "percent") {
      return Math.max(0, Math.round(original - (original * discountValue) / 100));
    }
    if (discountType === "flat") {
      return Math.max(0, Math.round(original - discountValue));
    }
    return original;
  }
  return 0;
};

const enrichCart = async (cart) => {
  await cart.populate("items.product", "name price imageUrl hasSizePricing sizePrices");
  await cart.populate("items.deal", "title imageUrl pricing");
  const items = (cart.items || [])
    .filter((it) => it.product || it.deal || it.title)
    .map((it) => {
      const qty = Math.max(1, Number(it.qty) || 1);
      const kind = String(it.kind || (it.deal ? "deal" : "product"));
      if (kind === "deal") {
        const unit = Number(it.deal?.pricing?.finalPrice) || Number(it.unitPrice) || 0;
        return {
          kind: "deal",
          deal: it.deal,
          title: String(it.deal?.title || it.title || "Deal"),
          imageUrl: String(it.deal?.imageUrl || it.imageUrl || ""),
          qty,
          size: "",
          unitPrice: unit,
          lineTotal: unit * qty,
        };
      }
      const size = normalizeSize(it.size);
      const unit = unitPrice(it.product, size);
      return {
        kind: "product",
        product: it.product,
        title: String(it.product?.name || it.title || "Item"),
        imageUrl: String(it.product?.imageUrl || it.imageUrl || ""),
        qty,
        size,
        unitPrice: unit,
        lineTotal: unit * qty,
      };
    });

  const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);

  return {
    _id: cart._id,
    cartId: cart.cartId,
    items,
    subtotal,
    totalItems: items.reduce((s, it) => s + it.qty, 0),
    updatedAt: cart.updatedAt,
  };
};

const getOrCreateCart = async (cartId) => {
  let cart = await Cart.findOne({ cartId });
  if (!cart) {
    cart = await Cart.create({ cartId, items: [] });
  }
  return cart;
};

const getCart = async (req, res) => {
  try {
    const cartId = String(req.params.cartId || "").trim();
    if (!cartId) return res.status(400).json({ message: "cartId is required." });
    const cart = await getOrCreateCart(cartId);
    const payload = await enrichCart(cart);
    return res.status(200).json({ cart: payload });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load cart." });
  }
};

const addCartItem = async (req, res) => {
  try {
    const cartId = String(req.params.cartId || "").trim();
    const { productId, dealId, qty = 1, size = "" } = req.body || {};
    if (!cartId) return res.status(400).json({ message: "cartId is required." });
    const isDeal = Boolean(dealId);
    if (!isDeal && !mongoose.Types.ObjectId.isValid(productId || "")) {
      return res.status(400).json({ message: "Valid productId is required." });
    }
    if (isDeal && !mongoose.Types.ObjectId.isValid(dealId || "")) {
      return res.status(400).json({ message: "Valid dealId is required." });
    }

    const cleanQty = Math.max(1, Number(qty) || 1);
    const cleanSize = isDeal ? "" : normalizeSize(size);

    if (isDeal) {
      const deal = await Deal.findById(dealId)
        .populate("items.product", "price hasSizePricing sizePrices")
        .populate("products", "price");
      if (!deal) return res.status(404).json({ message: "Deal not found." });
      const dealPrice = computeDealFinalPrice(deal);
      const incResult = await Cart.updateOne(
        { cartId, "items.kind": "deal", "items.deal": dealId },
        { $inc: { "items.$.qty": cleanQty } }
      );
      if (!incResult.matchedCount) {
        await Cart.updateOne(
          { cartId },
          {
            $setOnInsert: { cartId },
            $push: {
              items: {
                kind: "deal",
                deal: dealId,
                qty: cleanQty,
                size: "",
                unitPrice: dealPrice,
                title: String(deal.title || "Deal"),
                imageUrl: String(deal.imageUrl || ""),
              },
            },
          },
          { upsert: true }
        );
      }
      const cart = await getOrCreateCart(cartId);
      const payload = await enrichCart(cart);
      return res.status(200).json({ message: "Deal added to cart.", cart: payload });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found." });
    const baseUnit = unitPrice(product, cleanSize);
    const incResult = await Cart.updateOne(
      { cartId, "items.product": productId, "items.size": cleanSize },
      { $inc: { "items.$.qty": cleanQty }, $set: { "items.$.kind": "product" } }
    );

    if (!incResult.matchedCount) {
      await Cart.updateOne(
        { cartId },
        {
          $setOnInsert: { cartId },
          $push: {
            items: {
              kind: "product",
              product: productId,
              qty: cleanQty,
              size: cleanSize,
              unitPrice: baseUnit,
              title: String(product.name || ""),
              imageUrl: String(product.imageUrl || ""),
            },
          },
        },
        { upsert: true }
      );
    }

    const cart = await getOrCreateCart(cartId);
    const payload = await enrichCart(cart);
    return res.status(200).json({ message: "Item added to cart.", cart: payload });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to add item." });
  }
};

const updateCartItem = async (req, res) => {
  try {
    const cartId = String(req.params.cartId || "").trim();
    const { productId, dealId, qty = 1, size = "" } = req.body || {};
    if (!cartId) return res.status(400).json({ message: "cartId is required." });
    const isDeal = Boolean(dealId);
    if (!isDeal && !mongoose.Types.ObjectId.isValid(productId || "")) {
      return res.status(400).json({ message: "Valid productId is required." });
    }
    if (isDeal && !mongoose.Types.ObjectId.isValid(dealId || "")) {
      return res.status(400).json({ message: "Valid dealId is required." });
    }
    const cleanSize = isDeal ? "" : normalizeSize(size);
    const cleanQty = Math.max(1, Number(qty) || 1);

    const result = isDeal
      ? await Cart.updateOne(
          { cartId, "items.deal": dealId },
          { $set: { "items.$.qty": cleanQty, "items.$.kind": "deal" } }
        )
      : await Cart.updateOne(
          { cartId, "items.product": productId, "items.size": cleanSize },
          { $set: { "items.$.qty": cleanQty, "items.$.kind": "product" } }
        );
    if (!result.matchedCount) return res.status(404).json({ message: "Cart item not found." });
    const cart = await getOrCreateCart(cartId);
    const payload = await enrichCart(cart);
    return res.status(200).json({ message: "Cart item updated.", cart: payload });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update item." });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const cartId = String(req.params.cartId || "").trim();
    const { productId, dealId, size = "" } = req.body || {};
    if (!cartId) return res.status(400).json({ message: "cartId is required." });
    const isDeal = Boolean(dealId);
    if (!isDeal && !mongoose.Types.ObjectId.isValid(productId || "")) {
      return res.status(400).json({ message: "Valid productId is required." });
    }
    if (isDeal && !mongoose.Types.ObjectId.isValid(dealId || "")) {
      return res.status(400).json({ message: "Valid dealId is required." });
    }
    const cleanSize = isDeal ? "" : normalizeSize(size);

    await Cart.updateOne(
      { cartId },
      {
        $pull: {
          items: isDeal
            ? {
                deal: new mongoose.Types.ObjectId(dealId),
              }
            : {
                product: new mongoose.Types.ObjectId(productId),
                size: cleanSize,
              },
        },
      }
    );
    const cart = await getOrCreateCart(cartId);
    const payload = await enrichCart(cart);
    return res.status(200).json({ message: "Cart item removed.", cart: payload });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to remove item." });
  }
};

const clearCart = async (req, res) => {
  try {
    const cartId = String(req.params.cartId || "").trim();
    if (!cartId) return res.status(400).json({ message: "cartId is required." });
    await Cart.updateOne({ cartId }, { $set: { items: [] } }, { upsert: true });
    const cart = await getOrCreateCart(cartId);
    const payload = await enrichCart(cart);
    return res.status(200).json({ message: "Cart cleared.", cart: payload });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to clear cart." });
  }
};

module.exports = {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
};

