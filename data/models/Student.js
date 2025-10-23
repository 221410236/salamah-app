// data/models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  student_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },
  assigned_bus_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus' }, 
  home_location_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Location' },
  // Path to the generated printable card image
  card_url: { type: String, default: null }
});

module.exports = mongoose.model('Student', studentSchema);
