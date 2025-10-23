// application/routes/adminRoutes.js
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
  assignStudentsToBus,
  getBuses,
  createBus,
  getStudents,
  getAllStudentsWithCards,
  getParentById,
  addChildToParent,
  removeChildFromParent,
  getUnassignedBuses,  
  generateBusId,
  deleteBus,
  getAvailableBuses,
  viewAttendanceLogs
} = require("../controllers/adminController");

const router = express.Router();

// Admin creates accounts
router.post("/parents", createParent);
router.post("/drivers", createDriver);
router.post("/admins", createAdmin);

// Admin login
router.post("/admins/login", loginAdmin);

// Get combined accounts list 
router.get("/accounts", getAccounts);

// Update password (role + email)
router.put("/accounts/:role/:email/password", updatePasswordByEmail);

// Delete account (role + email)
router.delete("/accounts/:role/:email", deleteAccountByEmail);

// Generate student ID
router.get("/generate-student-id", generateStudentId);

router.post("/assign-students-bus", assignStudentsToBus);
router.get("/get-buses", getBuses);
router.get("/get-students", getStudents);
router.get("/get-all-students", require("../controllers/adminController").getAllStudentsWithCards);


//  Create New Student (Auto-generate QR code)
router.post("/students", async (req, res) => {
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


router.post("/buses", createBus);

// --- Manage Children Feature ---
router.get("/parents/:parentId", getParentById);
router.post("/parents/:parentId/children", addChildToParent);
router.delete("/parents/:parentId/children/:childId", removeChildFromParent);

// Get unassigned buses for driver assignment
router.get("/buses/unassigned", getUnassignedBuses);

//  Get unassigned drivers for bus assignment
router.get("/drivers/unassigned", require("../controllers/adminController").getUnassignedDrivers);

router.get("/generate-bus-id", generateBusId);

//  Assign a driver to a specific bus
router.post("/buses/:bus_id/assign-driver", require("../controllers/adminController").assignDriverToBus);

// Unassign a driver from a specific bus
router.put("/buses/:bus_id/unassign-driver", require("../controllers/adminController").unassignDriverFromBus);

router.delete("/buses/:bus_id", deleteBus);

// Get available buses for student assignment
router.get("/available-buses", getAvailableBuses);

// View attendance logs
router.get("/attendance-logs", viewAttendanceLogs);

module.exports = router;
