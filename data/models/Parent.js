// data/models/Admin.js
const mongoose = require("mongoose");

const parentSchema = new mongoose.Schema({
  parent_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true }, 
  phone_number: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, 
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],

  home_address: { type: String, required: true },
  home_coordinates: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      default: undefined
    }
  }
});

parentSchema.index({ home_coordinates: '2dsphere' });


module.exports = mongoose.model("Parent", parentSchema);