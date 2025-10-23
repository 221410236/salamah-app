// application/routes/notificationRoutes.js
const express = require("express");
const router = express.Router();
const NotificationController = require("../controllers/NotificationController");
const { sendAttendanceNotification } = require("../controllers/NotificationController");

// ================== SEND EMERGENCY ==================
// Used when a bus driver sends an emergency notification.
// Body must include: { bus_id, type ("delay"|"accident"|"breakdown"), message }
// Example: POST /api/notifications/emergency
router.post("/emergency", NotificationController.sendEmergencyNotification);

// ================== FETCH FOR ADMIN ==================
// Get all notifications intended for a specific admin.
// :adminId = admin’s MongoDB _id (string).
// Example: GET /api/notifications/admin/12345
router.get("/admin/:adminId", NotificationController.getAdminNotifications);

// ================== FETCH FOR PARENT ==================
// Get all notifications intended for a specific parent (based on their children’s bus).
// :parentId = parent’s MongoDB _id (string).
// Example: GET /api/notifications/parent/98765
router.get("/parent/:parentId", NotificationController.getParentNotifications);

// ================== MARK AS READ ==================
// Mark a specific notification as "read" for a given receiver.
// :sentId = the sent notification record
// :receiverId = the admin/parent’s MongoDB _id
// Example: PUT /api/notifications/mark-read/12345/67890
router.put("/mark-read/:sentId/:receiverId", NotificationController.markAsRead);

module.exports = router;
