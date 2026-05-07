const OrderRequest = require("../models/OrderRequest");
const Customer = require("../models/Customer");

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const getAdminAnalyticsSummary = async (_req, res) => {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const last7Start = new Date(todayStart);
    last7Start.setDate(last7Start.getDate() - 6);

    const [customersTotal, ordersTotal] = await Promise.all([
      Customer.countDocuments({}),
      OrderRequest.countDocuments({}),
    ]);

    const revenueAgg = await OrderRequest.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: null, revenue: { $sum: "$totalPayment" } } },
    ]);
    const revenueTotal = Number(revenueAgg?.[0]?.revenue || 0);

    const todayAgg = await OrderRequest.aggregate([
      { $match: { createdAt: { $gte: todayStart } } },
      {
        $group: {
          _id: null,
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $ne: ["$status", "cancelled"] }, "$totalPayment", 0],
            },
          },
        },
      },
    ]);
    const ordersToday = Number(todayAgg?.[0]?.orders || 0);
    const revenueToday = Number(todayAgg?.[0]?.revenue || 0);

    const statusBreakdownRaw = await OrderRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const statusBreakdown = (statusBreakdownRaw || []).reduce((acc, row) => {
      const key = String(row?._id || "unknown");
      acc[key] = Number(row?.count || 0);
      return acc;
    }, {});

    const last7DaysRaw = await OrderRequest.aggregate([
      { $match: { createdAt: { $gte: last7Start } } },
      {
        $group: {
          _id: {
            y: { $year: "$createdAt" },
            m: { $month: "$createdAt" },
            d: { $dayOfMonth: "$createdAt" },
          },
          orders: { $sum: 1 },
          revenue: {
            $sum: {
              $cond: [{ $ne: ["$status", "cancelled"] }, "$totalPayment", 0],
            },
          },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1, "_id.d": 1 } },
    ]);

    const last7Days = last7DaysRaw.map((r) => {
      const y = Number(r?._id?.y || 0);
      const m = Number(r?._id?.m || 1);
      const d = Number(r?._id?.d || 1);
      const dt = new Date(y, m - 1, d);
      return {
        date: dt.toISOString(),
        label: dt.toLocaleDateString("en-US", { weekday: "short" }),
        orders: Number(r?.orders || 0),
        revenue: Number(r?.revenue || 0),
      };
    });

    const topItemsRaw = await OrderRequest.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.title",
          qty: { $sum: "$items.qty" },
          revenue: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 6 },
    ]);

    const topItems = (topItemsRaw || []).map((r) => ({
      title: String(r?._id || ""),
      qty: Number(r?.qty || 0),
      revenue: Number(r?.revenue || 0),
    }));

    return res.status(200).json({
      summary: {
        customersTotal,
        ordersTotal,
        revenueTotal,
        ordersToday,
        revenueToday,
      },
      statusBreakdown,
      last7Days,
      topItems,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load analytics." });
  }
};

module.exports = { getAdminAnalyticsSummary };
