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

    // Basic validation
    if (!bus_id) return res.status(400).send("bus_id is required");
    if (!message || !message.trim())
      return res.status(400).send("message is required");

    const allowed = ["delay", "accident", "breakdown"];
    if (!allowed.includes(type))
      return res.status(400).send("type must be one of: delay, accident, breakdown");

    // Message length validation
    if (message.length < 10 || message.length > 200) {
      return res
        .status(400)
        .send("Message must be between 10 and 200 characters long");
    }

    // Rate Limiting: One emergency every 10 minutes for any type
    const cooldown = 10 * 60 * 1000;
    const now = Date.now();

    const recentEmergency = await SentNotification.findOne({
      sent_at: { $gte: new Date(now - cooldown) }
    })
      .sort({ sent_at: -1 })
      .populate("notification_id", "type");

    // Only block if the recent notification’s type was "emergency"
    if (recentEmergency?.notification_id?.type === "delay" ||
        recentEmergency?.notification_id?.type === "accident" ||
        recentEmergency?.notification_id?.type === "breakdown") {
      const diff = now - recentEmergency.sent_at.getTime();
      const minutesLeft = Math.ceil((cooldown - diff) / 60000);

      return res.status(429).json({
        error: `⚠️ Emergency already reported recently. Try again in ${minutesLeft} min`
      });
  }


    // Auto format message
    const formattedMessage = `[${type.toUpperCase()}] - ${message.trim()}`;

    // 1) Record the notification
    const notification = await Notification.create({
      notification_id: uuidv4(),
      message: formattedMessage,
      type,
    });

    // 2) Resolve receivers
    const admins = await Admin.find({}).lean();
    const students = await Student.find({ assigned_bus_id: bus_id })
      .select("parent_id")
      .lean();

    const parentIds = [...new Set(students.map(s => String(s.parent_id)))];
    const parents = parentIds.length
      ? await Parent.find({ _id: { $in: parentIds } }).lean()
      : [];

    // Include receiver status tracking
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

    // 3) Save SentNotification
    let sentLog;
    try {
      sentLog = await SentNotification.create({
        sent_id: uuidv4(),
        notification_id: notification.notification_id,
        sent_at: new Date(),
        receivers,
      });

      // 4) Send emails
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
      req.body.location
        ? `
        <h3 style="color:#5a5a5a;">📍 Current Location</h3>
        <a href="https://www.google.com/maps?q=${req.body.location.lat},${req.body.location.lng}"
          style="background:#007bff; color:white; padding:8px 14px; text-decoration:none; border-radius:6px;"
          target="_blank">Open in Google Maps</a>`
        : `<p style="color:gray;">Location unavailable</p>`
    }

    <hr style="margin-top:30px;">
    <p style="font-size: 13px; color: #777;">Sent automatically by <strong>Salamah System</strong></p>
  </div>
      `;



      for (const r of receivers) {
        const email =
          r.receiver_role === "admin"
            ? admins.find(a => a._id.toString() === r.receiver_id)?.email
            : parents.find(p => p._id.toString() === r.receiver_id)?.email;

        if (!email) continue;
        await sendEmail(email, subject, emailHtml);
      }

      return res.send("Emergency notification sent successfully");

    } catch (emailErr) {
      console.error("Email failed — rolling back entries:", emailErr.message);

      await Notification.deleteOne({ notification_id: notification.notification_id });
      if (sentLog) await SentNotification.deleteOne({ sent_id: sentLog.sent_id });

      return res.status(500).json({
        error: "Failed to send notification email. Please try again."
      });
    }

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
