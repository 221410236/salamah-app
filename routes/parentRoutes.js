const express = require("express");
const { loginParent } = require("../controllers/parentController");

const router = express.Router();

// Parent login
router.post("/login", loginParent);

module.exports = router;
