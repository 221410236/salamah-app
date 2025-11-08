// application/controllers/absenceController.js

const Parent = require("../../data/models/Parent");
const Student = require("../../data/models/Student");
const { markAbsent, isAbsent, getAllAbsences } = require("../services/absenceStore");

// REPORT ABSENCE (Called by Parent)
exports.reportAbsence = async (req, res) => {
  try {
    const { studentId, busId, parentId } = req.body;
    const io = req.app.get("io");

    if (!studentId || !busId || !parentId)
      return res.status(400).json({ message: "Missing required fields" });

    const parent = await Parent.findById(parentId).populate("children");
    if (!parent) return res.status(404).json({ message: "Parent not found" });

    const student = parent.children.find(c => c.student_id === studentId);
    if (!student)
      return res.status(403).json({
        message: "You can only report absences for your own children"
      });

    if (isAbsent(studentId))
      return res.status(409).json({
        message: "This student is already marked absent for today"
      });

    // Mark absent in memory
    markAbsent(studentId);

    // Notify all drivers in real time
    io.emit("student:absent", {
      studentId,
      busId,
      studentName: student.name,
    });

    res.json({ message: `Absence reported for ${student.name}` });
  } catch (err) {
    console.error("❌ Error in reportAbsence:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET TODAY’S ABSENCES (Called by Driver & Parent on Refresh)
exports.getTodayAbsences = async (req, res) => {
  try {
    const absents = getAllAbsences(); // array of studentIds
    res.json(absents);
  } catch (err) {
    console.error("❌ Error in getTodayAbsences:", err);
    res.status(500).json({ message: "Error fetching today's absences" });
  }
};
