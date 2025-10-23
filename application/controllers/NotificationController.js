//application/controllers/NotificationController.js
const Notification = require("../../data/models/Notification");
const SentNotification = require("../../data/models/SentNotification");
const Admin = require("../../data/models/Admin");
const Parent = require("../../data/models/Parent");
const Student = require("../../data/models/Student");

const { v4: uuidv4 } = require("uuid");

const { sendEmail } = require("../services/emailservice");

// ================== SEND EMERGENCY (Sprint 2) ==================
// Driver selects: delay | accident | breakdown, and provides a message.
// We require bus_id ONLY to resolve which parents to notify (not stored).
exports.sendEmergencyNotification = async (req, res) => {
  try {
    const { bus_id, type, message } = req.body;

    // ---- Basic validation  ----
    if (!bus_id) return res.status(400).send("bus_id is required");
    if (!message || !message.trim())
      return res.status(400).send("message is required");
    const allowed = ["delay", "accident", "breakdown"];
    if (!allowed.includes(type))
      return res.status(400).send("type must be one of: delay, accident, breakdown");

    // ---- 1) Record the notification  ----
    const notification = await Notification.create({
      notification_id: uuidv4(),
      message,
      type, // "delay" | "accident" | "breakdown"
    });

    // ---- 2) Resolve receivers ----
    // Admins: all; Parents: those whose children are on this bus.
    const admins = await Admin.find({}).lean();

    const students = await Student.find({ assigned_bus_id: bus_id })
      .select("parent_id")
      .lean();

    const parentIds = [...new Set(students.map((s) => String(s.parent_id)))];
    const parents = parentIds.length
      ? await Parent.find({ _id: { $in: parentIds } }).lean()
      : [];

    const receivers = [
      ...admins.map((a) => ({
        receiver_id: a._id.toString(),
        receiver_role: "admin",
        status: "unread",
      })),
      ...parents.map((p) => ({
        receiver_id: p._id.toString(),
        receiver_role: "parent",
        status: "unread",
      })),
    ];

    // ---- 3) Save SentNotification ----
    await SentNotification.create({
      sent_id: uuidv4(),
      notification_id: notification.notification_id,
      sent_at: new Date(),
      receivers,
    });

    // ---- 4) Send emails  ----
    for (const r of receivers) {
      const email =
        r.receiver_role === "admin"
          ? admins.find((a) => a._id.toString() === r.receiver_id)?.email
          : parents.find((p) => p._id.toString() === r.receiver_id)?.email;

      if (!email) continue;

      const subject = `🚨 Emergency: ${type.toUpperCase()}`;
      try {
        await sendEmail(email, subject, message);
      } catch (e) {
        console.error(`Email failed for ${email}:`, e.message);
      }
    }

    return res.send("Emergency notification sent successfully");
  } catch (err) {
    console.error("Error in sendEmergencyNotification:", err);
    return res.status(500).send("Failed to send notification");
  }
};

// ================== SEND ATTENDANCE NOTIFICATION (Sprint 3)==================
exports.sendAttendanceNotification = async (student, bus, status) => {
  try {
    const { v4: uuidv4 } = require("uuid");
    const Notification = require("../../data/models/Notification");
    const SentNotification = require("../../data/models/SentNotification");
    const Parent = require("../../data/models/Parent");
    const { sendEmail } = require("../services/emailservice");

    // Create a new notification
    const message = `Your child ${student.name} has ${status} Bus ${bus.bus_id} at ${new Date().toLocaleTimeString()}.`;
    const notification = await Notification.create({
      notification_id: uuidv4(),
      message,
      type: "attendance",
    });

    // Parent receiver only
    const receivers = [
      {
        receiver_id: student.parent_id._id.toString(),
        receiver_role: "parent",
        status: "unread",
      },
    ];

    // Save the sent notification
    await SentNotification.create({
      sent_id: uuidv4(),
      notification_id: notification.notification_id,
      sent_at: new Date(),
      receivers,
    });

    // Send email to parent
    const parentDoc = await Parent.findById(student.parent_id);
    if (parentDoc?.email) {
      await sendEmail(
        parentDoc.email,
        "Bus Attendance Update",
        message
      );
    }

    console.log(`Attendance notification sent to parent: ${student.name}`);
  } catch (err) {
    console.error("Error sending attendance notification:", err);
  }
};

// ================== ADMIN FETCH ==================
// Returns latest notifications for an admin (merged with Notification doc)
exports.getAdminNotifications = async (req, res) => {
  try {
    const { adminId } = req.params;

    const sent = await SentNotification.find({
      "receivers.receiver_id": adminId.toString(),
    })
      .sort({ sent_at: -1 })
      .limit(20)
      .lean();

    if (!sent.length) return res.json([]);

    const notifications = await Notification.find({
      notification_id: { $in: sent.map((s) => s.notification_id) },
    }).lean();

    const merged = sent.map((s) => ({
      sent_id: s.sent_id,
      sent_at: s.sent_at,
      receivers: s.receivers,
      notification:
        notifications.find((n) => n.notification_id === s.notification_id) || null,
    }));

    return res.json(merged);
  } catch (err) {
    console.error("Error fetching admin notifications:", err);
    return res.status(500).send("Failed to fetch admin notifications");
  }
};

// ================== PARENT FETCH ==================
// Returns latest notifications for a parent (merged with Notification doc)
exports.getParentNotifications = async (req, res) => {
  try {
    const { parentId } = req.params;

    const sent = await SentNotification.find({
      "receivers.receiver_id": parentId.toString(),
    })
      .sort({ sent_at: -1 })
      .limit(20)
      .lean();

    if (!sent.length) return res.json([]);

    const notifications = await Notification.find({
      notification_id: { $in: sent.map((s) => s.notification_id) },
    }).lean();

    const merged = sent.map((s) => ({
      sent_id: s.sent_id,
      sent_at: s.sent_at,
      receivers: s.receivers,
      notification:
        notifications.find((n) => n.notification_id === s.notification_id) || null,
    }));

    return res.json(merged);
  } catch (err) {
    console.error("Error fetching parent notifications:", err);
    return res.status(500).send("Failed to fetch parent notifications");
  }
};

// ================== MARK AS READ Controller ================== 
exports.markAsRead = async (req, res) => {
  try {
    const { sentId, receiverId } = req.params;

    await SentNotification.updateOne(
      { sent_id: sentId, "receivers.receiver_id": receiverId.toString() },
      { $set: { "receivers.$.status": "read" } }
    );

    return res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("Error marking notification as read:", err);
    return res.status(500).json({ error: "Failed to mark notification as read" });
  }
};
