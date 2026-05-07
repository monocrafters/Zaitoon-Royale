const mongoose = require("mongoose");
const Review = require("../models/Review");
const OrderRequest = require("../models/OrderRequest");

const listProductReviews = async (req, res) => {
  try {
    const title = String(req.query.title || "").trim();
    if (!title) return res.status(400).json({ message: "Product title is required." });

    const page = Math.max(0, Number(req.query.page || 0));
    const limit = Math.min(50, Math.max(5, Number(req.query.limit || 15)));
    const skip = page * limit;

    const [items, agg] = await Promise.all([
      Review.find({ productTitle: title }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Review.aggregate([
        { $match: { productTitle: title } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgRating: { $avg: "$rating" },
          },
        },
      ]),
    ]);

    const count = Number(agg?.[0]?.count || 0);
    const avg = Number(agg?.[0]?.avgRating || 0);

    return res.status(200).json({
      reviews: items,
      meta: { count, avgRating: avg },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load reviews." });
  }
};

const listMyPendingReviewItems = async (req, res) => {
  try {
    const customerId = req.customer?._id;
    if (!customerId) return res.status(401).json({ message: "Unauthorized" });

    const deliveredOrders = await OrderRequest.find({
      customerAccountId: customerId,
      status: "delivered",
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const pending = [];
    for (const order of deliveredOrders) {
      const orderId = order._id;
      const items = Array.isArray(order.items) ? order.items : [];
      for (const it of items) {
        // Only allow product reviews for product items.
        if (String(it.kind || "product") !== "product") continue;
        const productTitle = String(it.title || "").trim();
        if (!productTitle) continue;

        const exists = await Review.findOne({
          customerAccountId: customerId,
          orderId,
          productTitle,
        }).select("_id");
        if (exists) continue;

        pending.push({
          orderId,
          orderCreatedAt: order.createdAt,
          title: productTitle,
          imageUrl: String(it.imageUrl || ""),
          qty: Math.max(1, Number(it.qty) || 1),
        });
      }
    }

    return res.status(200).json({ pending });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load pending reviews." });
  }
};

const createMyReview = async (req, res) => {
  try {
    const customerId = req.customer?._id;
    if (!customerId) return res.status(401).json({ message: "Unauthorized" });

    const {
      orderId,
      productTitle,
      productId = "",
      productImageUrl = "",
      rating,
      reviewText = "",
    } = req.body || {};

    const r = Math.max(1, Math.min(5, Number(rating) || 0));
    const title = String(productTitle || "").trim();
    if (!title || !r) return res.status(400).json({ message: "productTitle and rating are required." });

    let chosenOrderId = orderId ? String(orderId) : "";
    if (chosenOrderId && !mongoose.isValidObjectId(chosenOrderId)) {
      return res.status(400).json({ message: "Invalid orderId." });
    }

    // If orderId provided, validate it is delivered and contains this product title.
    let orderDoc = null;
    if (chosenOrderId) {
      orderDoc = await OrderRequest.findOne({ _id: chosenOrderId, customerAccountId: customerId, status: "delivered" });
      if (!orderDoc) return res.status(403).json({ message: "Order is not delivered or not accessible." });
      const foundItem = (orderDoc.items || []).find((it) => String(it.title || "").trim() === title && String(it.kind || "product") === "product");
      if (!foundItem) return res.status(403).json({ message: "This product is not part of your delivered order." });
    } else {
      // Otherwise auto-pick the most recent delivered order that contains this product title and has no review yet.
      orderDoc = await OrderRequest.findOne({
        customerAccountId: customerId,
        status: "delivered",
        "items.kind": "product",
        "items.title": title,
      }).sort({ createdAt: -1 });
      if (!orderDoc) return res.status(403).json({ message: "No delivered order found for this product." });
      chosenOrderId = String(orderDoc._id);
      const exists = await Review.findOne({ customerAccountId: customerId, orderId: chosenOrderId, productTitle: title });
      if (exists) return res.status(409).json({ message: "You already reviewed this product for that order." });
    }

    const finalOrderId = chosenOrderId || String(orderDoc?._id || "");
    if (!finalOrderId) return res.status(400).json({ message: "orderId is required." });

    const already = await Review.findOne({ customerAccountId: customerId, orderId: finalOrderId, productTitle: title });
    if (already) return res.status(409).json({ message: "You already reviewed this product for that order." });

    const created = await Review.create({
      customerAccountId: customerId,
      customerName: req.customer.name || "Customer",
      customerPhone: String(req.customer.phone || ""),
      orderId: finalOrderId,
      productId: String(productId || ""),
      productTitle: title,
      productImageUrl: String(productImageUrl || ""),
      rating: r,
      reviewText: String(reviewText || "").trim(),
    });

    return res.status(201).json({ message: "Review submitted.", review: created });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to submit review." });
  }
};

const listAdminReviews = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const title = String(req.query.title || "").trim();

    const filter = {};
    if (title) filter.productTitle = title;
    if (q) {
      filter.$or = [
        { customerName: { $regex: q, $options: "i" } },
        { customerPhone: { $regex: q, $options: "i" } },
        { productTitle: { $regex: q, $options: "i" } },
        { reviewText: { $regex: q, $options: "i" } },
      ];
    }

    const items = await Review.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.status(200).json({ reviews: items });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load reviews." });
  }
};

const listLatestPublicReviews = async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(3, Number(req.query.limit || 8)));
    const reviews = await Review.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            orderId: "$orderId",
            customerName: "$customerName",
            reviewText: "$reviewText",
          },
          doc: { $first: "$$ROOT" },
        },
      },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $project: {
          customerName: 1,
          productTitle: 1,
          productImageUrl: 1,
          rating: 1,
          reviewText: 1,
          createdAt: 1,
        },
      },
    ]);
    return res.status(200).json({ reviews });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load latest reviews." });
  }
};

const listPublicReviewSummaries = async (req, res) => {
  try {
    const titlesRaw = String(req.query.titles || "").trim();
    const titles = titlesRaw
      ? titlesRaw
          .split("||")
          .map((t) => String(t || "").trim())
          .filter(Boolean)
      : [];

    const matchStage = titles.length ? { $match: { productTitle: { $in: titles } } } : null;
    const pipeline = [];
    if (matchStage) pipeline.push(matchStage);
    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$productTitle",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
          latestReviewText: { $first: "$reviewText" },
          latestImageUrl: { $first: "$productImageUrl" },
          latestCustomerName: { $first: "$customerName" },
        },
      },
      {
        $project: {
          _id: 0,
          productTitle: "$_id",
          avgRating: 1,
          count: 1,
          latestReviewText: 1,
          latestImageUrl: 1,
          latestCustomerName: 1,
        },
      }
    );

    const [summaries, orderCountsRaw] = await Promise.all([
      Review.aggregate(pipeline),
      OrderRequest.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $unwind: "$items" },
        ...(titles.length ? [{ $match: { "items.title": { $in: titles } } }] : []),
        {
          $group: {
            _id: "$items.title",
            orderCount: { $sum: 1 },
            orderQty: { $sum: { $max: [1, { $ifNull: ["$items.qty", 1] }] } },
          },
        },
      ]),
    ]);

    const orderMap = {};
    for (const row of orderCountsRaw || []) {
      const k = String(row?._id || "");
      if (!k) continue;
      orderMap[k] = {
        orderCount: Number(row?.orderCount || 0),
        orderQty: Number(row?.orderQty || 0),
      };
    }
    const merged = (summaries || []).map((s) => {
      const k = String(s?.productTitle || "");
      const stats = orderMap[k] || { orderCount: 0, orderQty: 0 };
      return { ...s, ...stats };
    });
    return res.status(200).json({ summaries: merged });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load review summaries." });
  }
};

module.exports = {
  listProductReviews,
  listMyPendingReviewItems,
  createMyReview,
  listAdminReviews,
  listLatestPublicReviews,
  listPublicReviewSummaries,
};

