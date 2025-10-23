//application/controllers/driverController.js
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
        _id: driver._id,  
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

exports.getDriverRoute = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Find driver by driver_id string 
    const driver = await Driver.findOne({ driver_id: driverId }).populate("assigned_bus_id");
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    // Find all students assigned to this bus and populate their parents
    const students = await Student.find({ assigned_bus_id: driver.assigned_bus_id._id })
      .populate("parent_id", "home_coordinates");

    // Collect waypoints
    const waypoints = students
      .map(s => s.parent_id?.home_coordinates?.coordinates)
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


