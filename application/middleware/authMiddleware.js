// application/middleware/authMiddleware.js

// Check if user is logged in
exports.requireLogin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ message: "Unauthorized — please log in first" });
  }
  next();
};

// Check if user has a specific role (admin, parent, driver)
exports.requireRole = (role) => {
  return (req, res, next) => {
    if (!req.session?.user || req.session.user.role !== role) {
      return res.status(403).json({ message: "Forbidden — insufficient permissions" });
    }
    next();
  };
};

// Quick endpoint to check who’s logged in (for frontend session persistence)
exports.me = (req, res) => {
  res.json({ user: req.session?.user || null });
};

// Logout endpoint helper
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Error logging out" });
    res.clearCookie("connect.sid"); // Clear session cookie
    res.json({ message: "Logged out successfully" });
  });
};
