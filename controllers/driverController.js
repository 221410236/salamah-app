// controllers/driverController.js
const bcrypt = require("bcryptjs");
const Driver = require("../models/Driver");
const Student = require("../models/Student");

exports.loginDriver = async (req, res) => {
  try {
    const { username, password } = req.body;

    const driver = await Driver.findOne({ username }).populate("assigned_bus_id");
    if (!driver) return res.status(400).json({ error: "Invalid username" });

    const match = await bcrypt.compare(password, driver.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    // Get students for this bus
    let students = [];
    if (driver.assigned_bus_id) {
      students = await Student.find({ assigned_bus_id: driver.assigned_bus_id._id })
        .populate("assigned_bus_id")
        .lean();
    }

    res.json({
      message: "Driver login successful",
      user: {
        driver_id: driver.driver_id,
        username: driver.username,
        bus: driver.assigned_bus_id,
        students
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
