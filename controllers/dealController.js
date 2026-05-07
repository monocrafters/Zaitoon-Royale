const mongoose = require("mongoose");
const Deal = require("../models/Deal");
const Product = require("../models/Product");

const computeDealPricing = (basePrice, discountType, discountValue) => {
  const base = Number(basePrice) || 0;
  const v = Number(discountValue) || 0;
  if (discountType === "percent") {
    const next = base - (base * Math.max(0, v)) / 100;
    return { originalPrice: base, finalPrice: Math.max(0, Math.round(next)) };
  }
  if (discountType === "flat") {
    const next = base - Math.max(0, v);
    return { originalPrice: base, finalPrice: Math.max(0, Math.round(next)) };
  }
  return { originalPrice: base, finalPrice: Math.max(0, Math.round(base)) };
};

const isDealLive = (deal) => {
  const now = Date.now();
  const endsAt = deal.endsAt ? new Date(deal.endsAt).getTime() : null;
  if (endsAt && now > endsAt) return false;
  return true;
};

const deactivateExpiredDeals = async () => {
  const now = new Date();
  await Deal.updateMany(
    { isActive: true, endsAt: { $ne: null, $lte: now } },
    { $set: { isActive: false } }
  );
};

const allowedSizes = new Set(["small", "medium", "large", "xlarge", ""]);

const normalizeDealItems = ({ items, products }) => {
  // Preferred: items: [{ product, qty }]
  if (Array.isArray(items) && items.length > 0) {
    const out = items
      .map((it) => ({
        product: String(it?.product || it?.productId || "").trim(),
        qty: Math.max(1, Number(it?.qty) || 1),
        size: allowedSizes.has(String(it?.size || "").trim()) ? String(it?.size || "").trim() : "",
      }))
      .filter((it) => it.product);
    return out.length ? out : [];
  }

  // Legacy: products: [id, id, ...] (qty defaults to 1)
  if (Array.isArray(products) && products.length > 0) {
    return products
      .map((id) => ({ product: String(id || "").trim(), qty: 1, size: "" }))
      .filter((it) => it.product);
  }

  return [];
};

const uniqueProductIdsFromItems = (items) => {
  const set = new Set();
  for (const it of items || []) {
    if (it?.product) set.add(String(it.product));
  }
  return Array.from(set);
};

const getUnitPriceForDealItem = (product, size) => {
  if (!product) return 0;
  const raw = String(size || "").trim();
  const normalized = allowedSizes.has(raw) ? raw : "";
  const has = Boolean(product?.hasSizePricing);
  const base = Number(product?.price) || 0;
  if (!has) return base;

  const prices = product?.sizePrices || {};
  const pick = (k) => Number(prices?.[k]) || 0;
  const want = normalized || "medium";
  const v = pick(want);
  if (v > 0) return v;
  // fallback: medium if chosen missing/0
  const mid = pick("medium");
  return mid > 0 ? mid : base;
};

const enrichDeal = (dealDoc) => {
  const deal = dealDoc?.toObject ? dealDoc.toObject() : dealDoc;
  const items = Array.isArray(deal?.items) ? deal.items : [];

  // Backward compat: if old deals have only products[], treat as qty=1 items.
  const legacyProducts = Array.isArray(deal?.products) ? deal.products : [];
  const mergedItems =
    items.length > 0
      ? items
      : legacyProducts.map((p) => ({
          product: p,
          qty: 1,
          size: "",
        }));

  const base = mergedItems.reduce((sum, it) => {
    const price = getUnitPriceForDealItem(it?.product, it?.size);
    const qty = Math.max(1, Number(it?.qty) || 1);
    return sum + price * qty;
  }, 0);

  const pricing = computeDealPricing(base, deal.discountType, deal.discountValue);
  return {
    ...deal,
    items: mergedItems,
    pricing,
    // convenience: allow frontend to always link to a detail page
    detailHref: `/deal/${deal._id}`,
  };
};

const getDeals = async (_req, res) => {
  try {
    await deactivateExpiredDeals();
    const deals = await Deal.find()
      .populate("items.product", "name price imageUrl description hasSizePricing sizePrices")
      .populate("products", "name price imageUrl description hasSizePricing sizePrices")
      .sort({ order: 1, createdAt: 1 });
    return res.status(200).json({ deals: deals.map(enrichDeal) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch deals." });
  }
};

const getPublicDeals = async (_req, res) => {
  try {
    await deactivateExpiredDeals();
    const deals = await Deal.find({ isActive: true })
      .populate("items.product", "name price imageUrl description hasSizePricing sizePrices")
      .populate("products", "name price imageUrl description hasSizePricing sizePrices")
      .sort({ order: 1, createdAt: 1 });
    const visible = deals.filter(isDealLive);
    return res.status(200).json({ deals: visible.map(enrichDeal) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch deals." });
  }
};

const getPublicDealById = async (req, res) => {
  try {
    await deactivateExpiredDeals();
    const id = String(req.params.id || "").trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Deal not found." });
    }

    const deal = await Deal.findById(id)
      .populate("items.product", "name price imageUrl description hasSizePricing sizePrices")
      .populate("products", "name price imageUrl description hasSizePricing sizePrices");
    if (!deal || !deal.isActive || !isDealLive(deal)) {
      return res.status(404).json({ message: "Deal not found." });
    }
    return res.status(200).json({ deal: enrichDeal(deal) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to fetch deal." });
  }
};

const createDeal = async (req, res) => {
  try {
    const {
      products,
      items,
      title,
      subtitle = "",
      description = "",
      badge = "",
      discountType = "percent",
      discountValue = 0,
      couponCode = "",
      imageUrl = "",
      startsAt = null,
      endsAt = null,
      theme = "warm",
      ctaLabel = "See Deal",
      ctaHref = "#offers",
      isActive = true,
    } = req.body || {};

    const normalizedItems = normalizeDealItems({ items, products });
    if (!normalizedItems.length) return res.status(400).json({ message: "At least one product is required." });

    const uniqueIds = uniqueProductIdsFromItems(normalizedItems);
    const productDocs = await Product.find({ _id: { $in: uniqueIds } }).select("_id name price imageUrl");
    if (!productDocs || productDocs.length !== uniqueIds.length) {
      return res.status(400).json({ message: "One or more selected products were not found." });
    }

    const cleanTitle =
      String(title || "").trim() || (productDocs[0]?.name ? String(productDocs[0].name).trim() : "");
    if (!cleanTitle) return res.status(400).json({ message: "Title is required." });

    const maxOrder = await Deal.findOne().sort({ order: -1 }).select("order");
    const nextOrder = (maxOrder?.order || 0) + 1;

    const productIdToDoc = new Map(productDocs.map((p) => [String(p._id), p]));
    const cleanedItems = normalizedItems
      .map((it) => ({
        product: it.product,
        qty: Math.max(1, Number(it.qty) || 1),
        size: allowedSizes.has(String(it.size || "").trim()) ? String(it.size || "").trim() : "",
      }))
      .filter((it) => productIdToDoc.has(String(it.product)));

    const deal = await Deal.create({
      items: cleanedItems,
      // keep legacy field filled for older frontends/tools
      products: uniqueIds,
      title: cleanTitle,
      subtitle: String(subtitle || "").trim(),
      description: String(description || "").trim(),
      badge: String(badge || "").trim(),
      discountType,
      discountValue: Number(discountValue) || 0,
      couponCode: String(couponCode || "").trim(),
      imageUrl: String(imageUrl || "").trim() || String(productDocs[0]?.imageUrl || "").trim(),
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      theme,
      ctaLabel: String(ctaLabel || "").trim() || "See Deal",
      ctaHref: String(ctaHref || "").trim() || "#offers",
      isActive: Boolean(isActive),
      order: nextOrder,
    });

    const populated = await Deal.findById(deal._id)
      .populate("items.product", "name price imageUrl description hasSizePricing sizePrices")
      .populate("products", "name price imageUrl description hasSizePricing sizePrices");
    return res.status(201).json({ message: "Deal created.", deal: enrichDeal(populated) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to create deal." });
  }
};

const updateDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: "Deal not found." });

    const {
      products,
      items,
      title,
      subtitle,
      description,
      badge,
      discountType,
      discountValue,
      couponCode,
      imageUrl,
      startsAt,
      endsAt,
      theme,
      ctaLabel,
      ctaHref,
      isActive,
    } = req.body || {};

    if (Array.isArray(products) || Array.isArray(items)) {
      const normalizedItems = normalizeDealItems({ items, products });
      if (!normalizedItems.length) return res.status(400).json({ message: "At least one product is required." });

      const uniqueIds = uniqueProductIdsFromItems(normalizedItems);
      const productDocs = await Product.find({ _id: { $in: uniqueIds } }).select("_id imageUrl");
      if (!productDocs || productDocs.length !== uniqueIds.length) {
        return res.status(400).json({ message: "One or more selected products were not found." });
      }

      const productIdSet = new Set(productDocs.map((p) => String(p._id)));
      deal.items = normalizedItems
        .map((it) => ({
          product: it.product,
          qty: Math.max(1, Number(it.qty) || 1),
          size: allowedSizes.has(String(it.size || "").trim()) ? String(it.size || "").trim() : "",
        }))
        .filter((it) => productIdSet.has(String(it.product)));
      deal.products = uniqueIds;
      if (!deal.imageUrl && productDocs[0]?.imageUrl) deal.imageUrl = String(productDocs[0].imageUrl).trim();
    }

    if (typeof title === "string") deal.title = title.trim();
    if (!deal.title) return res.status(400).json({ message: "Title is required." });

    if (typeof subtitle === "string") deal.subtitle = subtitle.trim();
    if (typeof description === "string") deal.description = description.trim();
    if (typeof badge === "string") deal.badge = badge.trim();
    if (typeof discountType === "string") deal.discountType = discountType;
    if (discountValue !== undefined) deal.discountValue = Number(discountValue) || 0;
    if (typeof couponCode === "string") deal.couponCode = couponCode.trim();
    if (typeof imageUrl === "string") deal.imageUrl = imageUrl.trim();
    if (startsAt === null || typeof startsAt === "string") deal.startsAt = startsAt ? new Date(startsAt) : null;
    if (endsAt === null || typeof endsAt === "string") deal.endsAt = endsAt ? new Date(endsAt) : null;
    if (typeof theme === "string") deal.theme = theme;
    if (typeof ctaLabel === "string") deal.ctaLabel = ctaLabel.trim() || "See Deal";
    if (typeof ctaHref === "string") deal.ctaHref = ctaHref.trim() || "#offers";
    if (typeof isActive === "boolean") deal.isActive = isActive;

    await deal.save();
    const populated = await Deal.findById(deal._id)
      .populate("items.product", "name price imageUrl description hasSizePricing sizePrices")
      .populate("products", "name price imageUrl description hasSizePricing sizePrices");
    return res.status(200).json({ message: "Deal updated.", deal: enrichDeal(populated) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update deal." });
  }
};

const deleteDeal = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) return res.status(404).json({ message: "Deal not found." });
    await Deal.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: "Deal deleted." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to delete deal." });
  }
};

const reorderDeals = async (req, res) => {
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

    await Deal.bulkWrite(bulk);
    const deals = await Deal.find().sort({ order: 1, createdAt: 1 });
    return res.status(200).json({ message: "Deals reordered.", deals });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to reorder deals." });
  }
};

module.exports = {
  getDeals,
  getPublicDeals,
  getPublicDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  reorderDeals,
};

