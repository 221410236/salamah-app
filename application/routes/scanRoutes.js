// Express route for handling scans
const express = require("express");
const router = express.Router();
const scanController = require("../controllers/scanController");
const { requireLogin, requireRole } = require("../middleware/authMiddleware");

// Requires driver authentication
router.post("/scan", requireLogin, requireRole("driver"), scanController.logScan);

module.exports = router;
