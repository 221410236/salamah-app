// data/models/SentNotification.js
const mongoose = require("mongoose");

const sentNotificationSchema = new mongoose.Schema({
  sent_id: { type: String, required: true, unique: true },
  notification_id: { type: String, required: true },
  sent_at: { type: Date, default: Date.now },
  receivers: [
    {
      receiver_id: { type: String, required: true },
      receiver_role: { type: String, enum: ["admin", "parent"], required: true },
      status: { type: String, default: "unread" },
    },
  ],
});

module.exports = mongoose.model("SentNotification", sentNotificationSchema);
