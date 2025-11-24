// application/controllers/scanController.js

const Attendance = require("../../data/models/Attendance");
const Student = require("../../data/models/Student");
const Bus = require("../../data/models/Bus");

const { sendAttendanceNotification } = require("./NotificationController");

exports.logScan = async (req, res) => {
  try {
    const { studentId, busId } = req.body;

    // ========== 1) Validate Input ==========
    if (!studentId || !busId) {
      return res.status(400).json({
        message: "Missing fields (studentId, busId)",
      });
    }

    // ========== 2) Verify Student ==========
    const student = await Student.findOne({ student_id: studentId }).populate("parent_id");
    if (!student) {
      return res.status(404).json({
        message: "Student not found",
      });
    }

    // Ensure this student belongs to the bus that scanned them
    if (String(student.assigned_bus_id) !== String(busId)) {
      return res.status(403).json({
        message: "Student not assigned to this bus",
      });
    }

    // ========== 3) Get LAST scan for this student (no date filter) ==========
    const lastScan = await Attendance.findOne({
      student_id: studentId,
    }).sort({ scan_time: -1 });   // newest first

    const now = Date.now();
    let nextStatus;

    // ========== 4) Decide status based on last scan ==========
    if (!lastScan) {
      // First scan ever → boarded
      nextStatus = "boarded";

    } else if (lastScan.status === "boarded") {
      const diffMs = now - new Date(lastScan.scan_time).getTime();

      // Duplicate within 5 minutes
      if (diffMs < 5 * 60 * 1000) {
        return res.status(200).json({
          message: "Duplicate scan ignored — please wait at least 5 minutes before re-scanning.",
          status: lastScan.status,
        });
      }

      // Otherwise → dropped off
      nextStatus = "dropped off";

    } else if (lastScan.status === "dropped off") {
      const diffMs = now - new Date(lastScan.scan_time).getTime();

      // Ignore quick re-scan within 1 minute
      if (diffMs < 60 * 1000) {
        return res.status(200).json({
          message: "Student recently dropped off. Ignoring quick re-scan.",
          status: lastScan.status,
        });
      }

      // Otherwise → boarded again
      nextStatus = "boarded";
    }

    // ========== 5) Save Attendance Record ==========
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({
        message: "Bus not found",
      });
    }

    const attendance = new Attendance({
      attendance_id: `ATT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      student_ref: student._id,
      student_id: student.student_id,
      bus_ref: bus._id,
      bus_id: bus.bus_id,
      status: nextStatus,
      scan_time: new Date(), // make sure it's set explicitly
    });

    await attendance.save();

    // ========== 6) Send Parent Notification (email + dashboard) ==========
    await sendAttendanceNotification(student, bus, nextStatus);

    // ========== 7) Respond to Driver Device ==========
    return res.status(200).json({
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
