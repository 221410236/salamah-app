// application/routes/driverRoutes.js
const express = require("express");
const { loginDriver, getDriverRoute } = require("../controllers/driverController");

const router = express.Router();

// Driver login
router.post("/login", loginDriver);
router.get("/route/:driverId", getDriverRoute);

module.exports = router;
