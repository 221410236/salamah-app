// data/models/Driver.js
const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  driver_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true }, 
  license_number: { type: String, required: true },
  phone_number: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  assigned_bus_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: false, default:null } 
});

module.exports = mongoose.model('Driver', driverSchema);
