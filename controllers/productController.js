const Product = require("../models/Product");
const Category = require("../models/Category");

const normalizeSizePrices = (value) => {
  const src = value || {};
  return {
    small: Number(src.small) || 0,
    medium: Number(src.medium) || 0,
    large: Number(src.large) || 0,
    xlarge: Number(src.xlarge) || 0,
  };
};

const getProducts = async (_req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name")
      .sort({ menuOrder: 1, createdAt: -1 });

    return res.status(200).json({ products });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to fetch products.",
    });
  }
};

const getPublicProducts = async (_req, res) => {
  try {
    const products = await Product.find()
      .populate("category", "name")
      .sort({ menuOrder: 1, createdAt: -1 });
    return res.status(200).json({ products });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to fetch products.",
    });
  }
};

const getPublicProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name");
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    return res.status(200).json({ product });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to fetch product.",
    });
  }
};

const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category", "name");

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    return res.status(200).json({ product });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to fetch product.",
    });
  }
};

const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      price = 0,
      quantity = 0,
      description = "",
      imageUrl = "",
      badge = "",
      hasSizePricing = false,
      sizePrices = {},
      menuOrder = 0,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Product name is required." });
    }

    if (!category) {
      return res.status(400).json({ message: "Category is required." });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ message: "Selected category does not exist." });
    }

    const parsedHasSizePricing = Boolean(hasSizePricing);
    const parsedSizePrices = normalizeSizePrices(sizePrices);
    const fallbackPrice = Number(price) || 0;
    const effectivePrice = parsedHasSizePricing ? parsedSizePrices.medium || fallbackPrice : fallbackPrice;

    const product = await Product.create({
      name: name.trim(),
      category,
      price: effectivePrice,
      hasSizePricing: parsedHasSizePricing,
      sizePrices: parsedSizePrices,
      quantity: Number(quantity) || 0,
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      badge: typeof badge === "string" ? badge.trim() : "",
      menuOrder: Number(menuOrder) || 0,
    });

    const populated = await Product.findById(product._id).populate("category", "name");
    return res.status(201).json({
      message: "Product added successfully.",
      product: populated,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to add product.",
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      price = 0,
      quantity = 0,
      description = "",
      imageUrl = "",
      badge = "",
      hasSizePricing = false,
      sizePrices = {},
      menuOrder,
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Product name is required." });
    }

    if (!category) {
      return res.status(400).json({ message: "Category is required." });
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(404).json({ message: "Selected category does not exist." });
    }

    const parsedHasSizePricing = Boolean(hasSizePricing);
    const parsedSizePrices = normalizeSizePrices(sizePrices);
    const fallbackPrice = Number(price) || 0;
    const effectivePrice = parsedHasSizePricing ? parsedSizePrices.medium || fallbackPrice : fallbackPrice;

    product.name = name.trim();
    product.category = category;
    product.price = effectivePrice;
    product.hasSizePricing = parsedHasSizePricing;
    product.sizePrices = parsedSizePrices;
    product.quantity = Number(quantity) || 0;
    product.description = description.trim();
    product.imageUrl = imageUrl.trim();
    product.badge = typeof badge === "string" ? badge.trim() : "";
    if (typeof menuOrder !== "undefined") {
      product.menuOrder = Number(menuOrder) || 0;
    }

    await product.save();

    const populated = await Product.findById(product._id).populate("category", "name");
    return res.status(200).json({
      message: "Product updated successfully.",
      product: populated,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to update product.",
    });
  }
};

const updateProductsMenuOrder = async (req, res) => {
  try {
    const { orders } = req.body;
    const clean = Array.isArray(orders)
      ? orders
          .map((o) => ({ id: String(o?.id || ""), menuOrder: Number(o?.menuOrder) || 0 }))
          .filter((o) => o.id)
      : [];

    if (!clean.length) {
      return res.status(400).json({ message: "orders[] is required." });
    }

    await Product.bulkWrite(
      clean.map((o) => ({
        updateOne: { filter: { _id: o.id }, update: { $set: { menuOrder: o.menuOrder } } },
      }))
    );

    return res.status(200).json({ message: "Menu order updated." });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to update menu order.",
    });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    await Product.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Product deleted successfully." });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to delete product.",
    });
  }
};

module.exports = {
  getPublicProducts,
  getPublicProductById,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductsMenuOrder,
};
