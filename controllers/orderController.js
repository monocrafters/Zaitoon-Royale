const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Customer = require("../models/Customer");
const OrderRequest = require("../models/OrderRequest");

const readCustomerIdFromAuth = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "restaurant-secret");
    if (decoded.role !== "customer" || !decoded.sub) return null;
    return String(decoded.sub);
  } catch {
    return null;
  }
};

const createOrderRequest = async (req, res) => {
  try {
    const { customer = {}, items = [], totalItems = 0, totalPayment = 0 } = req.body || {};

    const name = String(customer.name || "").trim();
    const phone = String(customer.phone || "").trim();
    const address = String(customer.address || "").trim();
    const city = String(customer.city || "").trim();
    const notes = String(customer.notes || "").trim();

    if (!name || !phone || !address) {
      return res.status(400).json({ message: "Name, phone and address are required." });
    }

    const cleanedItems = Array.isArray(items)
      ? items
          .map((it) => ({
            kind: it?.kind === "deal" ? "deal" : "product",
            title: String(it?.title || "").trim(),
            imageUrl: String(it?.imageUrl || "").trim(),
            qty: Math.max(1, Number(it?.qty) || 1),
            unitPrice: Math.max(0, Number(it?.unitPrice) || 0),
            lineTotal: Math.max(0, Number(it?.lineTotal) || 0),
          }))
          .filter((it) => it.title)
      : [];

    if (!cleanedItems.length) {
      return res.status(400).json({ message: "At least one order item is required." });
    }

    const computedTotalItems = cleanedItems.reduce((s, it) => s + it.qty, 0);
    const computedTotalPayment = cleanedItems.reduce((s, it) => s + it.lineTotal, 0);

    let customerAccountId = null;
    const tokenCustomerId = readCustomerIdFromAuth(req);
    if (tokenCustomerId) {
      const linked = await Customer.findById(tokenCustomerId).select("_id");
      if (linked) customerAccountId = linked._id;
    }

    const order = await OrderRequest.create({
      customerAccountId,
      customer: { name, phone, address, city, notes },
      items: cleanedItems,
      totalItems: Math.max(computedTotalItems, Number(totalItems) || 0),
      totalPayment: Math.max(computedTotalPayment, Number(totalPayment) || 0),
      status: "pending",
    });

    return res.status(201).json({
      message: "Order request created successfully.",
      order,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to create order request." });
  }
};

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();
const allowedStatuses = new Set(["pending", "confirmed", "preparing", "on_the_way", "delivered", "cancelled"]);
const normalizeReason = (value) => String(value || "").trim();

const listMyOrders = async (req, res) => {
  try {
    const orders = await OrderRequest.find({ customerAccountId: req.customer._id })
      .sort({ createdAt: -1 })
      .limit(80)
      .lean();

    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load orders." });
  }
};

const listAdminOrders = async (req, res) => {
  try {
    const status = normalizeStatus(req.query.status);
    const q = String(req.query.q || "").trim();
    const filter = {};
    if (allowedStatuses.has(status)) filter.status = status;
    if (q) {
      filter.$or = [
        { "customer.name": { $regex: q, $options: "i" } },
        { "customer.phone": { $regex: q, $options: "i" } },
        { "customer.city": { $regex: q, $options: "i" } },
        { "items.title": { $regex: q, $options: "i" } },
      ];
    }

    const orders = await OrderRequest.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return res.status(200).json({ orders });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load admin orders." });
  }
};

const getMyOrderById = async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid order id." });
    }

    const order = await OrderRequest.findOne({
      _id: orderId,
      customerAccountId: req.customer._id,
    }).lean();

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    return res.status(200).json({ order });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load order." });
  }
};

const getAdminOrderById = async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid order id." });
    }
    const order = await OrderRequest.findById(orderId).lean();
    if (!order) return res.status(404).json({ message: "Order not found." });
    return res.status(200).json({ order });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load order." });
  }
};

const updateAdminOrderStatus = async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId || !mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid order id." });
    }
    const nextStatus = normalizeStatus(req.body.status);
    if (!allowedStatuses.has(nextStatus)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const order = await OrderRequest.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found." });
    const cancelReason = normalizeReason(req.body.cancelReason);
    if (nextStatus === "cancelled" && !cancelReason) {
      return res.status(400).json({ message: "Cancellation reason is required." });
    }
    order.status = nextStatus;
    order.cancelReason = nextStatus === "cancelled" ? cancelReason : "";
    await order.save();
    return res.status(200).json({ message: "Order status updated.", order });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update order status." });
  }
};

module.exports = {
  createOrderRequest,
  listMyOrders,
  getMyOrderById,
  listAdminOrders,
  getAdminOrderById,
  updateAdminOrderStatus,
};
