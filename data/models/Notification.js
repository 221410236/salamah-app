// data/models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  notification_id: { type: String, required: true, unique: true },
  message: { type: String, required: true }, // how many messages can be sent in a short time frame (Once every 5 minutes)
  type: { type: String, required: true },
});

module.exports = mongoose.model("Notification", notificationSchema);
