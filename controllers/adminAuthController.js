const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const Admin = require("../models/Admin");

const createToken = (adminId) =>
  jwt.sign({ id: adminId }, process.env.JWT_SECRET || "restaurant-secret", {
    expiresIn: "1d",
  });

const registerAdmin = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        message: "Database is not connected. Add MONGO_URI and restart the server.",
      });
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const adminCount = await Admin.countDocuments();

    if (adminCount >= 1) {
      return res.status(409).json({
        message: "Only one admin account is allowed.",
      });
    }

    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });

    if (existingAdmin) {
      return res.status(409).json({
        message: "Admin with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Admin registered successfully.",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
      token: createToken(admin._id),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Admin registration failed.",
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(500).json({
        message: "Database is not connected. Add MONGO_URI and restart the server.",
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid admin credentials.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid admin credentials.",
      });
    }

    return res.status(200).json({
      message: "Admin login successful.",
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
      },
      token: createToken(admin._id),
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || "Admin login failed.",
    });
  }
};

const getAdminProfile = async (req, res) => {
  return res.status(200).json({
    admin: req.admin,
  });
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
};
