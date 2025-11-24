// application/controllers/scanController.js

const Attendance = require("../../data/models/Attendance");
const Student = require("../../data/models/Student");
const Bus = require("../../data/models/Bus");

const { sendAttendanceNotification } = require("./NotificationController");

exports.logScan = async (req, res) => {
  try {
    const { studentId, busId } = req.body;

    // =========================
    // 1. Validate Input
    // =========================
    if (!studentId || !busId) {
      return res.status(400).json({
        message: "Missing fields (studentId, busId)",
      });
    }

    // =========================
    // 2. Verify Student
    // =========================
    const student = await Student.findOne({ student_id: studentId }).populate("parent_id");
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Student MUST belong to the scanning bus
    if (String(student.assigned_bus_id) !== String(busId)) {
      return res.status(403).json({
        message: "Student not assigned to this bus",
      });
    }

    // =========================
    // 3. Define TODAY window
    // =========================
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // =========================
    // 4. Get TODAY'S last scan
    // =========================
    const lastScan = await Attendance.findOne({
      student_id: studentId,
      scan_time: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ scan_time: -1 });

    // Duplicate scan protection
    if (lastScan && Date.now() - new Date(lastScan.scan_time).getTime() < 5 * 60 * 1000) {
      return res.json({
        message: `Duplicate scan ignored — please wait at least 5 minutes before re-scanning.`,
        status: lastScan.status,
      });
    }

    // =========================
    // 5. Decide NEXT STATUS
    // =========================
    let nextStatus;

    if (!lastScan) {
      // First scan today → boarding
      nextStatus = "boarded";

    } else if (lastScan.status === "boarded") {
      // Last scan was boarding → dropped off
      nextStatus = "dropped off";

    } else if (lastScan.status === "dropped off") {
      // Prevent re-boarding if last drop-off was <1 min ago
      if (Date.now() - new Date(lastScan.scan_time).getTime() < 60 * 1000) {
        return res.json({
          message: "Student recently dropped off. Ignoring quick re-scan.",
          status: lastScan.status,
        });
      }
      nextStatus = "boarded";
    }

    // =========================
    // 6. Save Attendance Record
    // =========================
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    const attendance = new Attendance({
      attendance_id: `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      student_ref: student._id,
      student_id: student.student_id,
      bus_ref: bus._id,
      bus_id: bus.bus_id,
      status: nextStatus,
      scan_time: new Date(),
    });

    await attendance.save();

    // =========================
    // 7. Send Parent Notification
    // =========================
    await sendAttendanceNotification(student, bus, nextStatus);

    // =========================
    // 8. Respond to Scanner App
    // =========================
    return res.json({
      message: `Student ${student.name} ${nextStatus}`,
      status: nextStatus,
    });

  } catch (err) {
    console.error("❌ Scan error:", err);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
