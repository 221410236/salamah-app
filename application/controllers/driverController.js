// application/controllers/driverController.js
const bcrypt = require("bcryptjs");
const Driver = require("../../data/models/Driver");
const Student = require("../../data/models/Student");
const { isAbsent } = require("../services/absenceStore");

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
 
    res.json({
      message: "Driver login successful",
      user: {
        _id: driver._id,
        driver_id: driver.driver_id,
        username: driver.username,
        bus: driver.assigned_bus_id,
        students,
      },
    });
  } catch (err) {
    console.error("❌ loginDriver error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Driver Route (excludes absent students)

exports.getDriverRoute = async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await Driver.findOne({ driver_id: driverId }).populate("assigned_bus_id");
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    const students = await Student.find({
      assigned_bus_id: driver.assigned_bus_id._id,
    }).populate("parent_id", "home_coordinates");

    // Exclude students who are absent today
    const waypoints = students
      .filter(
        (s) =>
          s.parent_id?.home_coordinates?.coordinates &&
          !isAbsent(s.student_id)
      )
      .map((s) => ({
        lng: s.parent_id.home_coordinates.coordinates[0],
        lat: s.parent_id.home_coordinates.coordinates[1],
        student_id: s.student_id,
        name: s.name,
      }));

    if (waypoints.length === 0)
      return res.status(404).json({
        error: "No student home locations found or all absent today.",
      });

    console.log(`Driver ${driverId} route loaded — ${waypoints.length} active stops`);
    res.json({ waypoints });
  } catch (err) {
    console.error("getDriverRoute error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

