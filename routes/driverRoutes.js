const express = require("express");
const { loginDriver } = require("../controllers/driverController");

const router = express.Router();

// Driver login
router.post("/login", loginDriver);

module.exports = router;
