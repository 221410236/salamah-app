// server.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");

require("./models/Admin");
require("./models/Driver");
require("./models/Parent");
require("./models/Student");
require("./models/Bus");
require("./models/Location");

// Routes
const adminRoutes = require("./routes/adminRoutes");
const parentRoutes = require("./routes/parentRoutes");
const driverRoutes = require("./routes/driverRoutes");


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // adjust later for security (frontend URL)
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

// API Routes
app.use("/api/admin", adminRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/drivers", driverRoutes);

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Socket.IO handlers
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("location", (data) => {
    // Forward driver’s location to all others
    socket.broadcast.emit("location", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// Global error handler (optional but useful)
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
