const express = require("express");
const { loginParent, getQrCards } = require("../controllers/parentController");
const { requireLogin, requireRole } = require("../middleware/authMiddleware");

const router = express.Router();

// Parent login (public)
router.post("/login", loginParent);

//Get QR codes for all parent's associated children
// Requires parent authentication
router.get("/:id/qr-cards", requireLogin, requireRole("parent"), getQrCards);

module.exports = router;
