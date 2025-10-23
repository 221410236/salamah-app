// 🧠 Express route for handling scans
const express = require("express");
const router = express.Router();
const scanController = require("../controllers/scanController");

router.post("/scan", scanController.logScan);

module.exports = router;
