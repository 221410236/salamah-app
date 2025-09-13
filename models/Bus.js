// models/Bus.js
const mongoose = require("mongoose");

const busSchema = new mongoose.Schema({
  bus_id: { type: String, required: true, unique: true },
  plate_number: { type: String, required: true },
  capacity: { type: Number, required: true },
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" }
});

// ✅ Virtual: get all students assigned to this bus
busSchema.virtual("students", {
  ref: "Student",
  localField: "_id",
  foreignField: "assigned_bus_id"
});

busSchema.set("toObject", { virtuals: true });
busSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Bus", busSchema);
