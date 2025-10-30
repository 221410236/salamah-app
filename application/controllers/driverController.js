// application/controllers/driverController.js
const bcrypt = require("bcryptjs");
const Driver = require("../../data/models/Driver");
const Student = require("../../data/models/Student");

exports.loginDriver = async (req, res) => {
  try {
    const { username, password } = req.body;

    const driver = await Driver.findOne({ username }).populate("assigned_bus_id");
    if (!driver) return res.status(400).json({ error: "Invalid username" });

    const match = await bcrypt.compare(password, driver.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    // Create secure session
    req.session.user = {
      _id: driver._id,
      role: "driver",
      driver_id: driver.driver_id,
      username: driver.username,
      bus_id: driver.assigned_bus_id?._id || null,
    };

    // Load students on this driver's bus
    let students = [];
    if (driver.assigned_bus_id) {
      students = await Student.find({ assigned_bus_id: driver.assigned_bus_id._id })
        .populate("assigned_bus_id")
        .lean();
    }

    // Respond with minimal driver info 
    res.json({
      message: "Driver login successful",
      user: {
        username: driver.username,
        bus: driver.assigned_bus_id,
        students,
      },
    });
  } catch (err) {
    console.error("Driver login error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ======================================================

exports.getDriverRoute = async (req, res) => {
  try {
    const driverId = req.session.user.driver_id;

    const driver = await Driver.findOne({ driver_id: driverId }).populate("assigned_bus_id");
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    const students = await Student.find({ assigned_bus_id: driver.assigned_bus_id._id })
      .populate("parent_id", "home_coordinates");

    const waypoints = students
      .map((s) => s.parent_id?.home_coordinates?.coordinates)
      .filter(Boolean);

    if (waypoints.length === 0) {
      return res.status(404).json({ error: "No student home locations found." });
    }

    res.json({ waypoints });
  } catch (err) {
    console.error("getDriverRoute error:", err);
    res.status(500).json({ error: err.message });
  }
};

