const Attendance = require("../../data/models/Attendance");
const Student = require("../../data/models/Student");
const Bus = require("../../data/models/Bus");

const { sendAttendanceNotification } = require("./NotificationController");

exports.logScan = async (req, res) => {
  try {
    const { studentId, busId } = req.body;

    // Validate Input
    if (!studentId || !busId)
      return res.status(400).json({ message: "Missing fields (studentId, busId)" });

    // Verify Student
    const student = await Student.findOne({ student_id: studentId }).populate("parent_id");
    if (!student) return res.status(404).json({ message: "Student not found" });

    // Ensure this student belongs to the bus that scanned them
    if (String(student.assigned_bus_id) !== String(busId))
      return res.status(403).json({ message: "Student not assigned to this bus" });

    // Determine Scan Context 
    // Find today's time window (to group scans per day)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch the most recent scan for this student today
    const lastScan = await Attendance.findOne({
      student_id: studentId,
      scan_time: { $gte: startOfDay, $lte: endOfDay }, // Prevent duplicate scans within 10 second
    }).sort({ scan_time: -1 });
    
     // Prevent duplicate scans within 10 second
    if (lastScan && Date.now() - new Date(lastScan.scan_time).getTime() < 10000) {
      return res.json({
        message: `Duplicate scan ignored (last: ${lastScan.status})`,
        status: lastScan.status
      });
    }
    // Determine next status 
    let nextStatus;
    if (!lastScan) { 
      // First scan ever today
      nextStatus = "boarded";
    } else if (lastScan.status === "boarded") {
      // Last scan was boarding → now dropping off
      nextStatus = "dropped off";
    } else if (lastScan.status === "dropped off") {
      // Last scan was drop-off → ignore re-boarding within 1 minute (optional)  
      if (Date.now() - new Date(lastScan.scan_time).getTime() < 60000) {
        return res.json({
          message: `Student recently dropped off. Ignoring quick re-scan.`,
          status: lastScan.status
        })
      }
      nextStatus = "boarded";
    }
    // Save Attendance Record
    const bus = await Bus.findById(busId);
    const attendance = new Attendance({
      attendance_id: `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      student_ref: student._id,
      student_id: student.student_id,
      bus_ref: bus._id,
      bus_id: bus.bus_id,
      status: nextStatus,
    });

    await attendance.save();

    //  Send Parent Notification
    await sendAttendanceNotification(student, bus, nextStatus);

    // Respond to Frontend
    res.json({
      message: `Student ${student.name} ${nextStatus}`,
      status: nextStatus,
    });
  } catch (err) {
    console.error("❌ Scan error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
