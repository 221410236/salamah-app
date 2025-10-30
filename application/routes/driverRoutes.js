const express = require("express");
const { loginDriver, getDriverRoute } = require("../controllers/driverController");
const { requireLogin, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Driver login (public)
router.post("/login", loginDriver);

// Get driver route
// Requires driver authentication
router.get("/route/:driverId", requireLogin, requireRole("driver"), getDriverRoute);

module.exports = router;
