const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const http = require("http");

const connectDatabase = require("./config/db");
const { initSupportSocketServer } = require("./socket/supportSocket");
const adminAuthRoutes = require("./routes/adminAuthRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const productRoutes = require("./routes/productRoutes");
const heroRoutes = require("./routes/heroRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const dealRoutes = require("./routes/dealRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const customerRoutes = require("./routes/customerRoutes");
const supportRoutes = require("./routes/supportRoutes");
const contactRoutes = require("./routes/contactRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const reviewsRoutes = require("./routes/reviewsRoutes");
const notificationsRoutes = require("./routes/notificationsRoutes");

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "https://zaitoon-royale-frontend.vercel.app";

connectDatabase();

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    message: "Restaurant backend is running",
    status: "ok",
  });
});

app.use("/api/admin", adminAuthRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/hero", heroRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/notifications", notificationsRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({
    message: "Something went wrong on the server.",
  });
});

initSupportSocketServer(server, CLIENT_URL);

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
