const SupportTicket = require("../models/SupportTicket");
const ContactMessage = require("../models/ContactMessage");

const countUnreadForAdmin = (messages, adminLastReadAt) => {
  const last = adminLastReadAt ? new Date(adminLastReadAt).getTime() : 0;
  return (Array.isArray(messages) ? messages : []).filter(
    (m) => m && m.senderRole === "customer" && new Date(m.createdAt).getTime() > last
  ).length;
};

const listAdminNotifications = async (_req, res) => {
  try {
    const [tickets, contacts] = await Promise.all([
      SupportTicket.find({})
        .sort({ lastMessageAt: -1 })
        .limit(200)
        .select("customerName status messages adminLastReadAt lastMessageAt")
        .lean(),
      ContactMessage.find({ status: "new" })
        .sort({ createdAt: -1 })
        .limit(200)
        .select("name message createdAt")
        .lean(),
    ]);

    const supportNotifications = (tickets || [])
      .map((t) => {
        const unread = countUnreadForAdmin(t.messages, t.adminLastReadAt);
        if (unread <= 0) return null;
        const lastCustomerMessage = [...(t.messages || [])]
          .reverse()
          .find((m) => m && m.senderRole === "customer");
        return {
          id: `support-${String(t._id)}`,
          type: "support",
          title: `${t.customerName || "Customer"} sent ${unread} new message${unread > 1 ? "s" : ""}`,
          description: String(lastCustomerMessage?.text || "New support message"),
          createdAt: lastCustomerMessage?.createdAt || t.lastMessageAt || new Date(),
          href: `/admin/support/${String(t._id)}`,
          unreadCount: unread,
        };
      })
      .filter(Boolean);

    const contactNotifications = (contacts || []).map((c) => ({
      id: `contact-${String(c._id)}`,
      type: "contact",
      title: `New contact message from ${c.name || "visitor"}`,
      description: String(c.message || "Message received"),
      createdAt: c.createdAt || new Date(),
      href: "/admin/contact",
      unreadCount: 1,
    }));

    const notifications = [...supportNotifications, ...contactNotifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);

    const unreadSupportCount = supportNotifications.reduce((sum, n) => sum + Number(n.unreadCount || 0), 0);
    const unreadContactCount = contactNotifications.length;

    return res.status(200).json({
      notifications,
      summary: {
        unreadSupportCount,
        unreadContactCount,
        totalUnread: unreadSupportCount + unreadContactCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to load notifications." });
  }
};

module.exports = {
  listAdminNotifications,
};

