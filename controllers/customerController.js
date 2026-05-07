const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Customer = require("../models/Customer");
const OrderRequest = require("../models/OrderRequest");
const cloudinary = require("../config/cloudinary");

const normalizePhone = (value) => String(value || "").replace(/[\s-]/g, "").trim();

const createCustomerToken = (customerId) =>
  jwt.sign(
    { sub: String(customerId), role: "customer" },
    process.env.JWT_SECRET || "restaurant-secret",
    { expiresIn: "60d" }
  );

const checkoutUpsertCustomer = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = normalizePhone(req.body.phone);
    const email = String(req.body.email || "").trim().toLowerCase();
    const address = String(req.body.address || "").trim();
    const city = String(req.body.city || "").trim();

    if (!name || !phone || !address) {
      return res.status(400).json({ message: "Name, phone and address are required." });
    }

    let customer = await Customer.findOne({ phone });

    if (customer) {
      customer.name = name;
      customer.defaultAddress = address;
      customer.defaultCity = city;
      if (email) customer.email = email;
      await customer.save();
    } else {
      customer = await Customer.create({
        name,
        phone,
        email: email || "",
        defaultAddress: address,
        defaultCity: city,
      });
    }

    const token = createCustomerToken(customer._id);

    return res.status(200).json({
      message: "Account ready.",
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        profileImageUrl: customer.profileImageUrl || "",
        defaultAddress: customer.defaultAddress || "",
        defaultCity: customer.defaultCity || "",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to save customer." });
  }
};

const getCustomerMe = async (req, res) => {
  const c = req.customer;
  return res.status(200).json({
    customer: {
      id: c._id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      profileImageUrl: c.profileImageUrl || "",
      defaultAddress: c.defaultAddress,
      defaultCity: c.defaultCity,
    },
  });
};

const updateCustomerMe = async (req, res) => {
  try {
    const customerId = String(req.customer?._id || "");
    if (!customerId || !mongoose.isValidObjectId(customerId)) {
      return res.status(401).json({ message: "Invalid customer session." });
    }
    const customer = await Customer.findById(customerId);
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const defaultAddress = String(req.body.defaultAddress || "").trim();
    const defaultCity = String(req.body.defaultCity || "").trim();
    const profileImageUrl = String(req.body.profileImageUrl || "").trim();

    if (name) customer.name = name;
    customer.email = email;
    customer.defaultAddress = defaultAddress;
    customer.defaultCity = defaultCity;
    if (profileImageUrl) customer.profileImageUrl = profileImageUrl;
    await customer.save();

    return res.status(200).json({
      message: "Profile updated.",
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        profileImageUrl: customer.profileImageUrl || "",
        defaultAddress: customer.defaultAddress || "",
        defaultCity: customer.defaultCity || "",
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update profile." });
  }
};

const uploadCustomerAvatar = async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(500).json({ message: "Cloudinary is not configured." });
    }
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required." });
    }
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "restaurant/customers",
      resource_type: "image",
    });
    const customerId = String(req.customer?._id || "");
    if (customerId && mongoose.isValidObjectId(customerId)) {
      await Customer.findByIdAndUpdate(customerId, { $set: { profileImageUrl: result.secure_url } });
    }
    return res.status(200).json({ url: result.secure_url });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to upload avatar." });
  }
};

const listAdminCustomers = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const baseFilter = q
      ? {
          $or: [
            { name: { $regex: q, $options: "i" } },
            { phone: { $regex: q, $options: "i" } },
            { email: { $regex: q, $options: "i" } },
            { defaultCity: { $regex: q, $options: "i" } },
          ],
        }
      : {};

    const customers = await Customer.find(baseFilter).sort({ createdAt: -1 }).limit(300).lean();
    if (!customers.length) return res.status(200).json({ customers: [] });

    const byId = new Map(customers.map((c) => [String(c._id), c]));
    const ids = Array.from(byId.keys());
    const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

    const stats = await OrderRequest.aggregate([
      {
        $match: {
          $or: [
            { customerAccountId: { $in: objectIds } },
            { "customer.phone": { $in: customers.map((c) => String(c.phone || "")) } },
          ],
        },
      },
      {
        $addFields: {
          customerKey: {
            $ifNull: [{ $toString: "$customerAccountId" }, { $concat: ["phone:", "$customer.phone"] }],
          },
        },
      },
      {
        $group: {
          _id: "$customerKey",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: "$totalPayment" },
          latestOrderAt: { $max: "$createdAt" },
        },
      },
    ]);

    const byPhone = new Map(customers.map((c) => [`phone:${String(c.phone || "")}`, c]));
    const statsById = new Map();
    for (const s of stats) {
      const k = String(s._id || "");
      if (k.startsWith("phone:")) {
        const c = byPhone.get(k);
        if (!c) continue;
        const cid = String(c._id);
        const prev = statsById.get(cid) || { orderCount: 0, totalSpent: 0, latestOrderAt: null };
        statsById.set(cid, {
          orderCount: prev.orderCount + Number(s.orderCount || 0),
          totalSpent: prev.totalSpent + Number(s.totalSpent || 0),
          latestOrderAt:
            !prev.latestOrderAt || new Date(s.latestOrderAt) > new Date(prev.latestOrderAt)
              ? s.latestOrderAt
              : prev.latestOrderAt,
        });
      } else if (byId.has(k)) {
        const prev = statsById.get(k) || { orderCount: 0, totalSpent: 0, latestOrderAt: null };
        statsById.set(k, {
          orderCount: prev.orderCount + Number(s.orderCount || 0),
          totalSpent: prev.totalSpent + Number(s.totalSpent || 0),
          latestOrderAt:
            !prev.latestOrderAt || new Date(s.latestOrderAt) > new Date(prev.latestOrderAt)
              ? s.latestOrderAt
              : prev.latestOrderAt,
        });
      }
    }

    const out = customers.map((c) => {
      const st = statsById.get(String(c._id)) || { orderCount: 0, totalSpent: 0, latestOrderAt: null };
      return {
        id: c._id,
        name: c.name,
        phone: c.phone,
        email: c.email || "",
        profileImageUrl: c.profileImageUrl || "",
        defaultAddress: c.defaultAddress || "",
        defaultCity: c.defaultCity || "",
        createdAt: c.createdAt,
        orderCount: st.orderCount,
        totalSpent: st.totalSpent,
        latestOrderAt: st.latestOrderAt,
      };
    });

    return res.status(200).json({ customers: out });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load customers." });
  }
};

const getAdminCustomerById = async (req, res) => {
  try {
    const id = String(req.params.customerId || "").trim();
    if (!id || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid customer id." });
    }

    const customer = await Customer.findById(id).lean();
    if (!customer) return res.status(404).json({ message: "Customer not found." });

    const orders = await OrderRequest.find({
      $or: [{ customerAccountId: customer._id }, { "customer.phone": String(customer.phone || "") }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const totalOrders = orders.length;
    const spent = orders.reduce((s, o) => s + (o.status === "cancelled" ? 0 : Number(o.totalPayment || 0)), 0);
    const lastOrderAt = orders[0]?.createdAt || null;

    return res.status(200).json({
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || "",
        profileImageUrl: customer.profileImageUrl || "",
        defaultAddress: customer.defaultAddress || "",
        defaultCity: customer.defaultCity || "",
        createdAt: customer.createdAt,
        stats: { totalOrders, totalSpent: spent, lastOrderAt },
      },
      orders,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load customer." });
  }
};

module.exports = {
  checkoutUpsertCustomer,
  getCustomerMe,
  updateCustomerMe,
  uploadCustomerAvatar,
  listAdminCustomers,
  getAdminCustomerById,
};
