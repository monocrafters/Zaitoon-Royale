const express = require("express");

const { createOrderRequest } = require("../controllers/orderController");

const router = express.Router();

router.post("/", createOrderRequest);

module.exports = router;

