// routes/adminRoutes.js
const express = require("express");
const {
  createParent,
  createDriver,
  createAdmin,
  getAccounts,
  updatePasswordByEmail,
  deleteAccountByEmail,
  loginAdmin
} = require("../controllers/adminController");

const router = express.Router();

// Admin creates accounts
router.post("/parents", createParent);
router.post("/drivers", createDriver);
router.post("/admins", createAdmin);

// Admin login
router.post("/admins/login", loginAdmin);

// Get combined accounts list (used by admin UI)
router.get("/accounts", getAccounts);

// Update password (role + email)
router.put("/accounts/:role/:email/password", updatePasswordByEmail);

// Delete account (role + email)
router.delete("/accounts/:role/:email", deleteAccountByEmail);

module.exports = router;
