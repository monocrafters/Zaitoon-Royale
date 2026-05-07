const ContactMessage = require("../models/ContactMessage");

const createContactMessage = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const phone = String(req.body.phone || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const message = String(req.body.message || "").trim();

    if (!name || !message) {
      return res.status(400).json({ message: "Name and message are required." });
    }

    const doc = await ContactMessage.create({ name, phone, email, message });
    return res.status(201).json({ message: "Message sent successfully.", contact: doc });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to send message." });
  }
};

const listContactMessagesAdmin = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim();
    const filter = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            $or: [
              { name: { $regex: q, $options: "i" } },
              { phone: { $regex: q, $options: "i" } },
              { email: { $regex: q, $options: "i" } },
              { message: { $regex: q, $options: "i" } },
            ],
          }
        : {}),
    };

    const contacts = await ContactMessage.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    return res.status(200).json({ contacts });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load contact messages." });
  }
};

const updateContactStatusAdmin = async (req, res) => {
  try {
    const status = String(req.body.status || "").trim();
    if (!["new", "reviewed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }
    const doc = await ContactMessage.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Message not found." });
    doc.status = status;
    await doc.save();
    return res.status(200).json({ message: "Status updated.", contact: doc });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to update status." });
  }
};

module.exports = {
  createContactMessage,
  listContactMessagesAdmin,
  updateContactStatusAdmin,
};
