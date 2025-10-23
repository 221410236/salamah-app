// data/models/Location.js
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  gps_id: { type: String, required: true, unique: true },
  address: String,
  latitude: Number,
  longitude: Number,
  type: String // e.g. "home", "school", "stop"
});

module.exports = mongoose.model('Location', locationSchema);
