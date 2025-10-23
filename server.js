// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// ========== Socket.IO Setup ==========
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for now (you can restrict later)
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// ========== Middleware ==========
app.use(express.json());
app.use(cors());

// ========== Static Files (Presentation Layer) ==========
// Serve everything under "presentation" at /presentation
app.use(express.static(path.join(__dirname, "presentation")));


// ========== Database Connection (Data Layer) ==========
require("./data/config/database"); // Handles MongoDB connection

// ========== Load Models (Data Layer) ==========
require("./data/models/Admin");
require("./data/models/Driver");
require("./data/models/Parent");
require("./data/models/Student");
require("./data/models/Bus");
require("./data/models/Location");

// ========== Import Routes (Application Layer) ==========
const adminRoutes = require("./application/routes/adminRoutes");
const parentRoutes = require("./application/routes/parentRoutes");
const driverRoutes = require("./application/routes/driverRoutes");
const notificationRoutes = require("./application/routes/notificationRoutes");
const scanRoutes = require("./application/routes/scanRoutes");

// ========== Use Routes ==========
app.use("/api/admin", adminRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/notifications", notificationRoutes);
// this line for QR scanning endpoint
app.use("/api", scanRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== Default Route (Home Page) ==========
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "presentation/html/home.html"));
});

// Optional redirects for cleaner URLs
app.get("/login", (req, res) => {
  res.redirect("/html/login.html");
});
app.get("/admin", (req, res) => {
  res.redirect("/html/admin.html");
});
app.get("/parent", (req, res) => {
  res.redirect("/html/parent.html");
});
app.get("/driver", (req, res) => {
  res.redirect("/html/driver.html");
});

// ========== Socket.IO Handlers ==========
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("location", (data) => {
    // Forward driver’s location to all connected clients
    socket.broadcast.emit("location", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// ========== Global Error Handler ==========
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ========== Start Server ==========
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Salamah server running at http://localhost:${PORT}`);
});
