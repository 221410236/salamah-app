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
      bus: driver.assigned_bus_id || null, 
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
    // 1. Group students by coordinates (siblings -> same stop)
    const groups = {}; // key = "lng,lat"
    students.forEach((s) => {
      const coords = s.parent_id?.home_coordinates?.coordinates;
      if (!coords) return;
      const key = `${coords[0]},${coords[1]}`;
      if (!groups[key]) {
        groups[key] = {
          lng: coords[0],
          lat: coords[1],
          students: [],
        };
      }
      groups[key].students.push(s);
    });

    // 2. Keep stop if at least one sibling is NOT absent
    const waypoints = Object.values(groups)
    .filter((group) =>
      group.students.some((s) => !isAbsent(s.student_id))
  )
  .map((group) => ({
    lng: group.lng,
    lat: group.lat,
    student_ids: group.students.map((s) => s.student_id),
    names: group.students.map((s) => s.name),
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

