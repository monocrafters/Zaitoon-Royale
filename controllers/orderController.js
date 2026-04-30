const OrderRequest = require("../models/OrderRequest");

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

    const order = await OrderRequest.create({
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

module.exports = { createOrderRequest };

