const mongoose = require("mongoose");

const Category = require("../models/Category");
const Product = require("../models/Product");

const getCategories = async (_req, res) => {
  try {
    const categories = await Category.aggregate([
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "category",
          as: "products",
        },
      },
      {
        $addFields: {
          productsCount: { $size: "$products" },
        },
      },
      {
        $project: {
          products: 0,
        },
      },
      {
        $sort: { menuOrder: 1, createdAt: -1 },
      },
    ]);

    return res.status(200).json({
      categories,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to fetch categories.",
    });
  }
};

const getCategoryProducts = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(String(id || ""))) {
      return res.status(400).json({
        message: "Invalid category id.",
      });
    }
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
      });
    }

    const products = await Product.find({ category: id }).sort({ menuOrder: 1, createdAt: -1 });

    return res.status(200).json({
      category,
      products,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to fetch category products.",
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description = "", imageUrl = "", menuOrder = 0 } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required.",
      });
    }

    const normalizedName = name.trim();
    const exists = await Category.findOne({
      name: { $regex: `^${normalizedName}$`, $options: "i" },
    });

    if (exists) {
      return res.status(409).json({
        message: "This category already exists.",
      });
    }

    const category = await Category.create({
      name: normalizedName,
      description: description.trim(),
      imageUrl: imageUrl.trim(),
      menuOrder: Number(menuOrder) || 0,
    });

    return res.status(201).json({
      message: "Category added successfully.",
      category,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to add category.",
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description = "", imageUrl = "", isActive, menuOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required.",
      });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
      });
    }

    const normalizedName = name.trim();
    const duplicate = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${normalizedName}$`, $options: "i" },
    });

    if (duplicate) {
      return res.status(409).json({
        message: "Another category with this name already exists.",
      });
    }

    category.name = normalizedName;
    category.description = description.trim();
    category.imageUrl = imageUrl.trim();
    if (typeof isActive === "boolean") {
      category.isActive = isActive;
    }
    if (typeof menuOrder !== "undefined") {
      category.menuOrder = Number(menuOrder) || 0;
    }

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully.",
      category,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to update category.",
    });
  }
};

const updateCategoriesMenuOrder = async (req, res) => {
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

    await Category.bulkWrite(
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

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found.",
      });
    }

    const deletedProducts = await Product.deleteMany({ category: category._id });
    await Category.findByIdAndDelete(id);

    return res.status(200).json({
      message: "Category deleted successfully.",
      deletedProductsCount: deletedProducts.deletedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Unable to delete category.",
    });
  }
};

module.exports = {
  getCategories,
  getCategoryProducts,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoriesMenuOrder,
};
