// data/models/Admin.js
const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  admin_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true }, 
  phone_number: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

module.exports = mongoose.model('Admin', adminSchema);
