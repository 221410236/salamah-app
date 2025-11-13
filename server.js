require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");

const isProd = process.env.NODE_ENV === "production";

const app = express();
const server = http.createServer(app);

// ========== Socket.IO Setup ==========
const io = new Server(server, {
  cors: {
    origin: isProd
      ? "https://salamah-rc3h.onrender.com"
      : "http://localhost:5000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

// Make io accessible to controllers
app.set("io", io);

// ========== Middleware ==========
app.use(express.json());

app.use(
  cors({
    origin: isProd
      ? "https://salamah-rc3h.onrender.com"
      : "http://localhost:5000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

// ========== Secure Sessions ==========
const session = require("express-session");
const MongoStore = require("connect-mongo");

app.set("trust proxy", 1);

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 60 * 60 * 24,
    }),
    cookie: {
      httpOnly: true,
      secure: isProd, // TRUE in production (HTTPS)
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60,
    },
  })
);

// ========== Static Files ==========
app.use(express.static(path.join(__dirname, "presentation")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ========== Database Connection ==========
require("./data/config/database");

// ========== Load Models ==========
require("./data/models/Admin");
require("./data/models/Driver");
require("./data/models/Parent");
require("./data/models/Student");
require("./data/models/Bus");
require("./data/models/Location");

// ========== Import Routes ==========
const adminRoutes = require("./application/routes/adminRoutes");
const parentRoutes = require("./application/routes/parentRoutes");
const driverRoutes = require("./application/routes/driverRoutes");
const notificationRoutes = require("./application/routes/notificationRoutes");
const scanRoutes = require("./application/routes/scanRoutes");
const busRoutes = require("./application/routes/busRoutes");
const absenceRoutes = require("./application/routes/absenceRoutes");

// ========== Use Routes ==========
app.use("/api/admin", adminRoutes);
app.use("/api/buses", busRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/drivers", driverRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api", scanRoutes);
app.use("/api/absence", absenceRoutes);

const { me, logout } = require("./application/middleware/authMiddleware");
app.get("/api/auth/me", me);
app.post("/api/auth/logout", logout);

// ========== Default Route ==========
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "presentation/html/home.html"));
});

// ========== Socket.IO ==========
io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("location", (data) => {
    socket.broadcast.emit("location", data);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// ========== Error Handler ==========
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ========== Start Server ==========
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Salamah server running at http://localhost:${PORT}`);
});
