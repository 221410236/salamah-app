// application/controllers/scanController.js

const Attendance = require("../../data/models/Attendance");
const Student = require("../../data/models/Student");
const Bus = require("../../data/models/Bus");

const { sendAttendanceNotification } = require("./NotificationController");

exports.logScan = async (req, res) => {
  try {
    const { studentId, busId } = req.body;

    // Validate Input
    if (!studentId || !busId) {
      return res.status(200).json({
        success: false,
        message: "Missing fields (studentId, busId)",
      });
    }

    // Verify Student
    const student = await Student.findOne({ student_id: studentId }).populate("parent_id");
    if (!student) {
      return res.status(200).json({
        success: false,
        message: "Student not found",
      });
    }

    // Ensure student belongs to this bus
    if (String(student.assigned_bus_id) !== String(busId)) {
      return res.status(200).json({
        success: false,
        message: "Student not assigned to this bus",
      });
    }

    // ============================
    // TIMEZONE FIX (KSA TIME)
    // ============================
    const now = new Date();
    const ksaNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const startOfDay = new Date(Date.UTC(
      ksaNow.getUTCFullYear(),
      ksaNow.getUTCMonth(),
      ksaNow.getUTCDate(),
      0, 0, 0, 0
    ));

    const endOfDay = new Date(Date.UTC(
      ksaNow.getUTCFullYear(),
      ksaNow.getUTCMonth(),
      ksaNow.getUTCDate(),
      23, 59, 59, 999
    ));

    // ============================
    // FIND TODAY'S LAST SCAN
    // ============================
    const lastScan = await Attendance.findOne({
      student_id: studentId,
      scan_time: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ scan_time: -1 });

    // ============================
    // DUPLICATE SCAN BLOCK (5 min)
    // ============================
    if (
      lastScan &&
      Date.now() - new Date(lastScan.scan_time).getTime() < 5 * 60 * 1000
    ) {
      return res.status(200).json({
        success: true,
        message: `Duplicate scan ignored — please wait at least 5 minutes before re-scanning.`,
        status: lastScan.status,
      });
    }

    // ============================
    // DETERMINE NEXT STATUS
    // ============================
    let nextStatus;

    if (!lastScan) {
      nextStatus = "boarded";
    }
    else if (lastScan.status === "boarded") {
      nextStatus = "dropped off";
    }
    else if (lastScan.status === "dropped off") {
      // Prevent quick rescan (within 1 min)
      if (Date.now() - new Date(lastScan.scan_time).getTime() < 60 * 1000) {
        return res.status(200).json({
          success: true,
          message: `Student recently dropped off. Ignoring quick re-scan.`,
          status: lastScan.status,
        });
      }
      nextStatus = "boarded";
    }

    // ============================
    // SAVE SCAN
    // ============================
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

    // ============================
    // SEND PARENT EMAIL
    // ============================
    await sendAttendanceNotification(student, bus, nextStatus);

    // ============================
    // SEND RESPONSE TO DRIVER UI
    // ============================
    return res.status(200).json({
      success: true,
      message: `Student ${student.name} ${nextStatus}`,
      status: nextStatus,
    });

  } catch (err) {
    console.error("❌ Scan error:", err);

    return res.status(200).json({
      success: false,
      message: "Internal server error",
    });
  }
};