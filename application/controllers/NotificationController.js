//application/controllers/NotificationController.js
const Notification = require("../../data/models/Notification");
const SentNotification = require("../../data/models/SentNotification");
const Admin = require("../../data/models/Admin");
const Parent = require("../../data/models/Parent");
const Student = require("../../data/models/Student");
const Driver = require("../../data/models/Driver");

const { v4: uuidv4 } = require("uuid");

const { sendEmail } = require("../services/emailservice");

// ================== SEND EMERGENCY (Sprint 2) ==================
// Driver selects: delay | accident | breakdown, and provides a message.
// We require bus_id ONLY to resolve which parents to notify (not stored).
exports.sendEmergencyNotification = async (req, res) => {
  try {
    const { bus_id, type, message, location } = req.body;

    if (!bus_id) return res.status(400).json({ error: "bus_id is required" });
    if (!message || !message.trim())
      return res.status(400).json({ error: "message is required" });

    const allowed = ["delay", "accident", "breakdown"];
    if (!allowed.includes(type))
      return res.status(400).json({ error: "Invalid type" });

    if (message.length < 10 || message.length > 200)
      return res.status(400).json({ error: "Message must be 10–200 chars" });

    // Rate limit — last 10 minutes
    const cooldown = 10 * 60 * 1000;
    const now = Date.now();
    const recentEmergency = await SentNotification.findOne({
      sent_at: { $gte: new Date(now - cooldown) }
    })
      .sort({ sent_at: -1 })
      .populate("notification_id", "type");

    if (["delay", "accident", "breakdown"].includes(recentEmergency?.notification_id?.type)) {
      const diff = now - recentEmergency.sent_at.getTime();
      const minutesLeft = Math.ceil((cooldown - diff) / 60000);

      return res.status(429).json({
        error: `⚠️ Emergency already reported recently. Try again in ${minutesLeft} min`
      });
    }

    // Format
    const formattedMessage = `[${type.toUpperCase()}] - ${message.trim()}`;

    const notification = await Notification.create({
      notification_id: uuidv4(),
      message: formattedMessage,
      type,
    });

    const admins = await Admin.find({}).lean();
    const students = await Student.find({ assigned_bus_id: bus_id }).select("parent_id").lean();
    const parentIds = [...new Set(students.map(s => String(s.parent_id)))];
    const parents = parentIds.length
      ? await Parent.find({ _id: { $in: parentIds } }).lean()
      : [];

    const receivers = [
      ...admins.map(a => ({
        receiver_id: a._id.toString(),
        receiver_role: "admin",
        status: "unread",
      })),
      ...parents.map(p => ({
        receiver_id: p._id.toString(),
        receiver_role: "parent",
        status: "unread",
      })),
    ];

    let sentLog = await SentNotification.create({
      sent_id: uuidv4(),
      notification_id: notification.notification_id,
      sent_at: new Date(),
      receivers,
    });


    return res.status(200).json({
      success: true,
      message: "Emergency notification sent successfully"
    });

  } catch (err) {
    console.error("Error in sendEmergencyNotification:", err);
    return res.status(500).json({ error: "Failed to send notification" });
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
    const path = require("path");

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

    // Send email to parent with same HTML format as emergency notifications
    const parentDoc = await Parent.findById(student.parent_id);
    if (parentDoc?.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 16px;">
          <img src="cid:salamahlogo" alt="Salamah Logo" style="height:70px; margin-bottom:10px; display:block;" />
          <h2 style="color: #007bff;">🚌 Student Attendance Update</h2>

          <p><strong>Student:</strong> ${student.name}</p>
          <p><strong>Status:</strong> ${status.toUpperCase()}</p>
          <p><strong>Bus:</strong> ${bus.bus_id}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>

          <hr/>
          <p style="font-size: 12px; color: #777;">
            Sent automatically by <strong>Salamah System</strong>
          </p>
        </div>
      `;

      await sendEmail(parentDoc.email, "Bus Attendance Update", emailHtml);
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
