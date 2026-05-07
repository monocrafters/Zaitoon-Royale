const jwt = require("jsonwebtoken");

const Customer = require("../models/Customer");

const protectCustomer = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please complete checkout to access your orders.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "restaurant-secret");

    if (decoded.role !== "customer" || !decoded.sub) {
      return res.status(401).json({ message: "Invalid customer session." });
    }

    const customer = await Customer.findById(decoded.sub).lean();

    if (!customer) {
      return res.status(401).json({ message: "Customer not found." });
    }

    req.customer = customer;
    next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired session." });
  }
};

module.exports = { protectCustomer };
