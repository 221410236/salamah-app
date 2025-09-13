const mongoose = require("mongoose");

const parentSchema = new mongoose.Schema({
  parent_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true }, 
  phone_number: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // bcrypt hash
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }] 
});

module.exports = mongoose.model("Parent", parentSchema);
