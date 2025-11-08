// application/routes/absenceRoutes.js
const express = require("express");
const router = express.Router();
const {
  reportAbsence,
  getTodayAbsences,
} = require("../controllers/absenceController");

const { requireLogin, requireRole } = require("../middleware/authMiddleware");

// Parent reports absence (only parents can do this)
router.post("/report", requireLogin, requireRole("parent"), reportAbsence);

// Driver or Parent fetch today's absences
router.get("/today", requireLogin, getTodayAbsences);

module.exports = router;
