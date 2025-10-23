// data/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  notification_id: { type: String, required: true, unique: true },
  message: { type: String, required: true },
  type: { type: String, required: true },
});

module.exports = mongoose.model("Notification", notificationSchema);
