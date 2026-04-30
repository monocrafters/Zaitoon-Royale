const HeroSlide = require("../models/HeroSlide");
const Product = require("../models/Product");
const Deal = require("../models/Deal");

const getHeroSlides = async (_req, res) => {
  try {
    const slides = await HeroSlide.find()
      .populate("product", "name description price imageUrl category hasSizePricing sizePrices")
      .populate({
        path: "deal",
        populate: { path: "items.product", select: "name price imageUrl description hasSizePricing sizePrices" },
      })
      .populate({
        path: "deal",
        populate: { path: "products", select: "name price imageUrl description hasSizePricing sizePrices" },
      })
      .sort({ order: 1, createdAt: 1 });
    return res.status(200).json({ slides });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch hero slides." });
  }
};

const getPublicHeroSlides = async (_req, res) => {
  try {
    const slides = await HeroSlide.find({ isActive: true })
      .populate("product", "name description price imageUrl category hasSizePricing sizePrices")
      .populate({
        path: "deal",
        populate: { path: "items.product", select: "name price imageUrl description hasSizePricing sizePrices" },
      })
      .populate({
        path: "deal",
        populate: { path: "products", select: "name price imageUrl description hasSizePricing sizePrices" },
      })
      .sort({ order: 1, createdAt: 1 });
    return res.status(200).json({ slides });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch hero slides." });
  }
};

const createHeroSlide = async (req, res) => {
  try {
    const {
      product,
      deal,
      kind = "product",
      headline = "",
      subheadline = "",
      badge = "",
      dealEndsAt = null,
      isActive = true,
      order,
    } = req.body || {};

    if (kind === "product" && !product) return res.status(400).json({ message: "Product is required." });
    if (kind === "deal" && !deal) return res.status(400).json({ message: "Deal is required." });

    if (kind === "product") {
      const exists = await Product.findById(product);
      if (!exists) return res.status(404).json({ message: "Selected product does not exist." });
    }
    if (kind === "deal") {
      const exists = await Deal.findById(deal);
      if (!exists) return res.status(404).json({ message: "Selected deal does not exist." });
    }

    const maxOrder = await HeroSlide.findOne().sort({ order: -1 }).select("order");
    const nextOrder = (maxOrder?.order || 0) + 1;
    const desiredOrder = Number(order);
    const chosenOrder = Number.isFinite(desiredOrder) && desiredOrder > 0 ? Math.floor(desiredOrder) : nextOrder;

    const slide = await HeroSlide.create({
      kind,
      product: kind === "product" ? product : null,
      deal: kind === "deal" ? deal : null,
      headline: String(headline || "").trim(),
      subheadline: String(subheadline || "").trim(),
      badge: String(badge || "").trim(),
      dealEndsAt: dealEndsAt ? new Date(dealEndsAt) : null,
      isActive: Boolean(isActive),
      order: chosenOrder,
    });

    // Reorder: put this slide at the desired position and renumber.
    const all = await HeroSlide.find().sort({ order: 1, createdAt: 1 }).select("_id");
    if (all?.length) {
      const ids = all.map((s) => String(s._id));
      const sid = String(slide._id);
      const filtered = ids.filter((x) => x !== sid);
      const pos = Math.min(Math.max(0, chosenOrder - 1), filtered.length);
      filtered.splice(pos, 0, sid);
      const bulk = filtered.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index + 1 } } },
      }));
      await HeroSlide.bulkWrite(bulk);
    }

    const populated = await HeroSlide.findById(slide._id)
      .populate("product", "name description price imageUrl category hasSizePricing sizePrices")
      .populate({
        path: "deal",
        populate: { path: "items.product", select: "name price imageUrl description hasSizePricing sizePrices" },
      })
      .populate({
        path: "deal",
        populate: { path: "products", select: "name price imageUrl description hasSizePricing sizePrices" },
      });
    return res.status(201).json({ message: "Hero slide created.", slide: populated });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to create hero slide." });
  }
};

const updateHeroSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) {
      return res.status(404).json({ message: "Hero slide not found." });
    }

    const { kind, headline, subheadline, badge, dealEndsAt, isActive, product, deal, order } = req.body || {};

    if (product) {
      const exists = await Product.findById(product);
      if (!exists) {
        return res.status(404).json({ message: "Selected product does not exist." });
      }
      slide.product = product;
    }

    if (deal) {
      const exists = await Deal.findById(deal);
      if (!exists) {
        return res.status(404).json({ message: "Selected deal does not exist." });
      }
      slide.deal = deal;
    }

    if (kind) slide.kind = kind;
    if (typeof headline === "string") slide.headline = headline.trim();
    if (typeof subheadline === "string") slide.subheadline = subheadline.trim();
    if (typeof badge === "string") slide.badge = badge.trim();
    if (typeof isActive === "boolean") slide.isActive = isActive;
    if (dealEndsAt === null || typeof dealEndsAt === "string") {
      slide.dealEndsAt = dealEndsAt ? new Date(dealEndsAt) : null;
    }
    if (order !== undefined) {
      const desired = Number(order);
      if (Number.isFinite(desired) && desired > 0) slide.order = Math.floor(desired);
    }

    // Ensure only the relevant ref stays set.
    if (slide.kind === "product") {
      if (!slide.product) return res.status(400).json({ message: "Product is required." });
      slide.deal = null;
    }
    if (slide.kind === "deal") {
      if (!slide.deal) return res.status(400).json({ message: "Deal is required." });
      slide.product = null;
    }

    await slide.save();

    // Reorder: move this slide to its order position and renumber.
    const all = await HeroSlide.find().sort({ order: 1, createdAt: 1 }).select("_id order");
    if (all?.length) {
      const ids = all.map((s) => String(s._id));
      const sid = String(slide._id);
      const filtered = ids.filter((x) => x !== sid);
      const desired = Number(slide.order) || 1;
      const pos = Math.min(Math.max(0, desired - 1), filtered.length);
      filtered.splice(pos, 0, sid);
      const bulk = filtered.map((id, index) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: index + 1 } } },
      }));
      await HeroSlide.bulkWrite(bulk);
    }

    const populated = await HeroSlide.findById(slide._id)
      .populate("product", "name description price imageUrl category hasSizePricing sizePrices")
      .populate({
        path: "deal",
        populate: { path: "items.product", select: "name price imageUrl description hasSizePricing sizePrices" },
      })
      .populate({
        path: "deal",
        populate: { path: "products", select: "name price imageUrl description hasSizePricing sizePrices" },
      });
    return res.status(200).json({ message: "Hero slide updated.", slide: populated });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update hero slide." });
  }
};

const deleteHeroSlide = async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    if (!slide) {
      return res.status(404).json({ message: "Hero slide not found." });
    }
    await HeroSlide.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Hero slide deleted." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to delete hero slide." });
  }
};

const reorderHeroSlides = async (req, res) => {
  try {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ message: "orderedIds array is required." });
    }

    const bulk = orderedIds.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } },
      },
    }));

    await HeroSlide.bulkWrite(bulk);
    const slides = await HeroSlide.find()
      .populate("product", "name description price imageUrl category hasSizePricing sizePrices")
      .populate({
        path: "deal",
        populate: { path: "items.product", select: "name price imageUrl description hasSizePricing sizePrices" },
      })
      .populate({
        path: "deal",
        populate: { path: "products", select: "name price imageUrl description hasSizePricing sizePrices" },
      })
      .sort({ order: 1, createdAt: 1 });
    return res.status(200).json({ message: "Hero slides reordered.", slides });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to reorder hero slides." });
  }
};

module.exports = {
  getHeroSlides,
  getPublicHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
  reorderHeroSlides,
};

