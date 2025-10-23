const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  attendance_id: { type: String, required: true, unique: true }, // e.g. ATT-20251019-XXXX
  student_ref: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  student_id: { type: String, required: true }, // for quick lookup (e.g., "STU123")
  bus_ref: { type: mongoose.Schema.Types.ObjectId, ref: "Bus", required: true },
  bus_id: { type: String, required: true }, // for display (e.g., "BUS0001")
  status: { type: String, enum: ["boarded", "dropped off"], required: true },
  scan_time: { type: Date, default: Date.now },
});

attendanceSchema.index({ student_id: 1, scan_time: -1 });
attendanceSchema.index({ bus_id: 1, scan_time: -1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
