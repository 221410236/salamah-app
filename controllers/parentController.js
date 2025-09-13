// controllers/parentController.js
const bcrypt = require("bcryptjs");
const Parent = require("../models/Parent");

exports.loginParent = async (req, res) => {
  try {
    const { username, password } = req.body;

    const parent = await Parent.findOne({ username }).populate({
      path: "children",
      populate: {
        path: "assigned_bus_id",
        populate: { path: "driver_id" }
      }
    });

    if (!parent) return res.status(400).json({ error: "Invalid username" });

    const match = await bcrypt.compare(password, parent.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    res.json({
      message: "Parent login successful",
      user: {
        parent_id: parent.parent_id,
        username: parent.username,
        children: parent.children
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
