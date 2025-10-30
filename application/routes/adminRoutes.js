const express = require("express");
const QRCode = require("qrcode");
const Student = require("../../data/models/Student");
const {
  createParent,
  createDriver,
  createAdmin,
  getAccounts,
  updatePasswordByEmail,
  deleteAccountByEmail,
  loginAdmin,
  generateStudentId,
  getAllStudentsWithCards,
  getParentById,
  addChildToParent,
  removeChildFromParent,
  viewAttendanceLogs
} = require("../controllers/adminController");

const { requireLogin, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Admin creates accounts
// Requires admin authentication
router.post("/parents", requireLogin, requireRole("admin"), createParent);
router.post("/drivers", requireLogin, requireRole("admin"), createDriver);
router.post("/admins", requireLogin, requireRole("admin"), createAdmin);

// Admin login (public route)
router.post("/admins/login", loginAdmin);

// Get combined accounts list 
// Requires admin authentication
router.get("/accounts", requireLogin, requireRole("admin"), getAccounts);

// Update password (role + email)
// Requires admin authentication
router.put("/accounts/:role/:email/password", requireLogin, requireRole("admin"), updatePasswordByEmail);

// Delete account (role + email)
// Requires admin authentication
router.delete("/accounts/:role/:email", requireLogin, requireRole("admin"), deleteAccountByEmail);

// Generate student ID
// Requires admin authentication
router.get("/generate-student-id", requireLogin, requireRole("admin"), generateStudentId);

router.get("/get-all-students", requireLogin, requireRole("admin"), require("../controllers/adminController").getAllStudentsWithCards);


//  Create New Student (Auto-generate QR code)
// Requires admin authentication
router.post("/students", requireLogin, requireRole("admin"), async (req, res) => {
  try {
    const { student_id, name, parent_id, assigned_bus_id, home_location_id } = req.body;

    // 🧩 Create the new student
    const newStudent = new Student({
      student_id,
      name,
      parent_id,
      assigned_bus_id,
      home_location_id
    });

    // 🪄Generate QR code containing the student_id
    const qrData = await QRCode.toDataURL(student_id); // Base64 QR image
    newStudent.qr_code = qrData;

    //  Save to MongoDB
    await newStudent.save();

    res.status(201).json({
      message: "✅ Student created successfully with QR code",
      student: newStudent
    });
  } catch (err) {
    console.error("❌ Error creating student:", err);
    res.status(500).json({ error: "Failed to create student" });
  }
});


// --- Manage Children Feature ---
// Requires admin authentication
router.get("/parents/:parentId", requireLogin, requireRole("admin"), getParentById);
router.post("/parents/:parentId/children", requireLogin, requireRole("admin"), addChildToParent);
router.delete("/parents/:parentId/children/:childId", requireLogin, requireRole("admin"), removeChildFromParent);

// View attendance logs
// Requires admin authentication
router.get("/attendance-logs", requireLogin, requireRole("admin"), viewAttendanceLogs);

module.exports = router;
