const express = require("express");
const {
  assignStudentsToBus,
  getBuses,
  getStudents,
  createBus,
  getUnassignedBuses,
  getUnassignedDrivers,
  generateBusId,
  assignDriverToBus,
  unassignDriverFromBus,
  deleteBus,
  getAvailableBuses,
  getAllBusLocations    
} = require("../controllers/busController");

const { requireLogin, requireRole } = require("../middleware/authMiddleware");
const router = express.Router();

// --- Student–Bus assignment ---
router.post("/assign-students-bus", requireLogin, requireRole("admin"), assignStudentsToBus);

// --- Bus listing and creation ---
router.get("/get-buses", requireLogin, requireRole("admin"), getBuses);
router.get("/get-students", requireLogin, requireRole("admin"), getStudents);
router.post("/buses", requireLogin, requireRole("admin"), createBus);

// --- Driver & Bus assignments ---
router.get("/buses/unassigned", requireLogin, requireRole("admin"), getUnassignedBuses);
router.get("/drivers/unassigned", requireLogin, requireRole("admin"), getUnassignedDrivers);
router.get("/generate-bus-id", requireLogin, requireRole("admin"), generateBusId);
router.post("/buses/:bus_id/assign-driver", requireLogin, requireRole("admin"), assignDriverToBus);
router.put("/buses/:bus_id/unassign-driver", requireLogin, requireRole("admin"), unassignDriverFromBus);

// --- Bus deletion & availability ---
router.delete("/buses/:bus_id", requireLogin, requireRole("admin"), deleteBus);
router.get("/available-buses", requireLogin, requireRole("admin"), getAvailableBuses);

// --- Admin fetch all bus locations for map ---
router.get("/locations/all", requireLogin, requireRole("admin"), getAllBusLocations);

module.exports = router;