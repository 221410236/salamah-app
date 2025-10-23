// application/routes/parentRoutes.js
const express = require("express");
const { loginParent, getQrCards } = require("../controllers/parentController");

const router = express.Router();

// Parent login
router.post("/login", loginParent);

//Get QR codes for all parent's associated children
router.get("/:id/qr-cards", getQrCards);

module.exports = router;
