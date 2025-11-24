// application/controllers/NotificationController.js

const Notification = require("../../data/models/Notification");
const SentNotification = require("../../data/models/SentNotification");
const Admin = require("../../data/models/Admin");
const Parent = require("../../data/models/Parent");
const Student = require("../../data/models/Student");
const Driver = require("../../data/models/Driver");

const { v4: uuidv4 } = require("uuid");
const { sendEmail } = require("../services/emailservice");

// ============================================================
// =============== SEND EMERGENCY NOTIFICATION =================
// ============================================================

exports.sendEmergencyNotification = async (req, res) => {
  try {
    const { bus_id, type, message, location } = req.body;

    // ----- Basic Validation -----
    if (!bus_id) return res.status(400).send("bus_id is required");
    if (!message || !message.trim())
      return res.status(400).send("message is required");

    const allowed = ["delay", "accident", "breakdown"];
    if (!allowed.includes(type))
      return res.status(400).send("type must be one of: delay, accident, breakdown");

    if (message.length < 10 || message.length > 200)
      return res.status(400).send("Message must be between 10 and 200 characters long");

    // ----- Rate Limit: 1 emergency per 10 minutes -----
    const cooldown = 10 * 60 * 1000;
    const now = Date.now();

    const recentEmergency = await SentNotification.findOne({
      sent_at: { $gte: new Date(now - cooldown) }
    })
      .sort({ sent_at: -1 })
      .populate("notification_id", "type");

    if (
      recentEmergency?.notification_id?.type === "delay" ||
      recentEmergency?.notification_id?.type === "accident" ||
      recentEmergency?.notification_id?.type === "breakdown"
    ) {
      const diff = now - recentEmergency.sent_at.getTime();
      const minutesLeft = Math.ceil((cooldown - diff) / 60000);

      return res.status(429).json({
        error: `⚠️ Emergency already reported recently. Try again in ${minutesLeft} min`
      });
    }

    // ----- Format Message -----
    const formattedMessage = `[${type.toUpperCase()}] - ${message.trim()}`;

    // ----- Create Notification -----
    const notification = await Notification.create({
      notification_id: uuidv4(),
      message: formattedMessage,
      type,
    });

    // ----- Resolve Receivers -----
    const admins = await Admin.find({}).lean();
    const students = await Student.find({ assigned_bus_id: bus_id })
      .select("parent_id")
      .lean();

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

    // ----- Save Sent Notification -----
    let sentLog = await SentNotification.create({
      sent_id: uuidv4(),
      notification_id: notification.notification_id,
      sent_at: new Date(),
      receivers,
    });

    // ----- Prepare Email -----
    const driver = await Driver.findOne({ assigned_bus_id: bus_id }).lean();
    const subject = `🚨 Emergency Alert: ${type.toUpperCase()}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin:auto;">
        <img src="cid:salamahlogo" alt="Salamah Logo" style="height:70px; margin-bottom:10px;">

        <h2 style="color: #d9534f; margin: 10px 0;">🚨 Emergency Notification</h2>

        <p><strong>Type:</strong> ${type.toUpperCase()}</p>
        <p><strong>Message:</strong> ${message}</p>

        <h3 style="color:#0056b3; margin-top:20px;">🚌 Driver Details</h3>
        <p>
          <strong>Name:</strong> ${driver?.name || "Unknown"}<br>
          <strong>Phone:</strong> ${driver?.phone_number || "—"}
        </p>

        ${
          location
            ? `
          <h3 style="color:#5a5a5a;">📍 Current Location</h3>
          <a href="https://www.google.com/maps?q=${location.lat},${location.lng}"
            style="background:#007bff; color:white; padding:8px 14px; text-decoration:none; border-radius:6px;"
            target="_blank">Open in Google Maps</a>`
            : `<p style="color:gray;">Location unavailable</p>`
        }

        <hr style="margin-top:30px;">
        <p style="font-size: 13px; color: #777;">Sent automatically by <strong>Salamah System</strong></p>
      </div>
    `;

    // ----- Send Email to All Receivers -----
    for (const r of receivers) {
      const email =
        r.receiver_role === "admin"
          ? admins.find(a => a._id.toString() === r.receiver_id)?.email
          : parents.find(p => p._id.toString() === r.receiver_id)?.email;

      if (!email) continue;

      await sendEmail(email, subject, emailHtml);
    }

    return res.send("Emergency notification sent successfully");

  } catch (err) {
    console.error("Error in sendEmergencyNotification:", err);
    return res.status(500).send("Failed to send notification");
  }
};

// ============================================================
// ============== SEND ATTENDANCE NOTIFICATION =================
// ============================================================

exports.sendAttendanceNotification = async (student, bus, status) => {
  try {
    const message = `Your child ${student.name} has ${status} Bus ${bus.bus_id} at ${new Date().toLocaleTimeString()}.`;

    const notification = await Notification.create({
      notification_id: uuidv4(),
      message,
      type: "attendance",
    });

    const receivers = [
      {
        receiver_id: student.parent_id._id.toString(),
        receiver_role: "parent",
        status: "unread",
      },
    ];

    await SentNotification.create({
      sent_id: uuidv4(),
      notification_id: notification.notification_id,
      sent_at: new Date(),
      receivers,
    });

    const parent = await Parent.findById(student.parent_id);

    if (parent?.email) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 16px;">
          <img src="cid:salamahlogo" alt="Salamah Logo" style="height:70px; margin-bottom:10px;" />
          <h2 style="color: #007bff;">🚌 Student Attendance Update</h2>

          <p><strong>Student:</strong> ${student.name}</p>
          <p><strong>Status:</strong> ${status.toUpperCase()}</p>
          <p><strong>Bus:</strong> ${bus.bus_id}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleTimeString()}</p>

          <hr/>
          <p style="font-size: 12px; color: #777;">Sent automatically by <strong>Salamah System</strong></p>
        </div>
      `;

      await sendEmail(parent.email, "Bus Attendance Update", emailHtml);
    }

    console.log(`Attendance notification sent to parent: ${student.name}`);

  } catch (err) {
    console.error("Error sending attendance notification:", err);
  }
};

// ============================================================
// ===================== FETCH FOR ADMIN =======================
// ============================================================

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
      notification_id: { $in: sent.map(s => s.notification_id) },
    }).lean();

    const merged = sent.map(s => ({
      sent_id: s.sent_id,
      sent_at: s.sent_at,
      receivers: s.receivers,
      notification:
        notifications.find(n => n.notification_id === s.notification_id) || null,
    }));

    return res.json(merged);

  } catch (err) {
    console.error("Error fetching admin notifications:", err);
    return res.status(500).send("Failed to fetch admin notifications");
  }
};

// ============================================================
// ===================== FETCH FOR PARENT ======================
// ============================================================

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
      notification_id: { $in: sent.map(s => s.notification_id) },
    }).lean();

    const merged = sent.map(s => ({
      sent_id: s.sent_id,
      sent_at: s.sent_at,
      receivers: s.receivers,
      notification:
        notifications.find(n => n.notification_id === s.notification_id) || null,
    }));

    return res.json(merged);

  } catch (err) {
    console.error("Error fetching parent notifications:", err);
    return res.status(500).send("Failed to fetch parent notifications");
  }
};

// ============================================================
// ==================== MARK AS READ ===========================
// ============================================================

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
