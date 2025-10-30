// application/controllers/adminController.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Admin = require("../../data/models/Admin");
const Parent = require("../../data/models/Parent");
const Driver = require("../../data/models/Driver");
const Student = require("../../data/models/Student");
const Bus = require("../../data/models/Bus");
const cardService = require("../services/cardService");
const Attendance = require("../../data/models/Attendance");



// Mapbox Geocoding service
const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
const geocoder = mbxGeocoding({ accessToken: process.env.MAPBOX_TOKEN });

// --- Generate Unique Student ID ---
async function generateStudentId() {
  let studentId;
  let exists = true;

  while (exists) {
    const randomNumbers = Math.floor(10000 + Math.random() * 90000);
    studentId = `STU${randomNumbers}`;

    // Check if the generated ID already exists in the DB
    const existingStudent = await Student.findOne({ student_id: studentId }).lean();
    exists = !!existingStudent;
  }

  return studentId;
}

exports.generateStudentId = async (req, res) => {
  try {
    const newStudentId = await generateStudentId(); // await because async
    res.json({ student_id: newStudentId });
  } catch (err) {
    console.error("Error generating student ID:", err);
    res.status(500).json({ error: "Failed to generate student ID" });
  }
};


/* ---------- Admin Login ---------- */
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ error: "Invalid username" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    // Create secure session
    req.session.user = {
      _id: admin._id,
      role: "admin",
      admin_id: admin.admin_id,
      username: admin.username,
    };

    // Include _id and role in the response for the frontend
    res.json({
      message: "Admin login successful",
      user: {
        _id: admin._id,       
        role: "admin",
        username: admin.username,
        admin_id: admin.admin_id,
        email: admin.email,
        name: admin.name
      },
    });
  } catch (err) {
    console.error("Admin login error:", err);
    res.status(500).json({ error: err.message });
  }
};



/* ---------- Create Admin ---------- */
exports.createAdmin = async (req, res) => {
  try {
    const { admin_id, name, phone_number, email, password, username } = req.body;
    if (!admin_id || !name ||!phone_number || !email || !password || !username) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    const exists = await Admin.findOne({ $or: [{ email }, { admin_id }, { username }] });
    if (exists) return res.status(400).json({ error: "Admin already exists (email, id, or username)" });

    const phoneExistsAdmin = await Admin.findOne({ phone_number });
    const phoneExistsDriver = await Driver.findOne({ phone_number });
    const phoneExistsParent = await Parent.findOne({ phone_number });
    if (phoneExistsAdmin || phoneExistsDriver || phoneExistsParent) {
      return res.status(400).json({ error: "Phone number already in use" });
    }

    const hashedPw = await bcrypt.hash(password, 10);
    const admin = new Admin({ admin_id, name, email, phone_number, password: hashedPw, username });
    await admin.save();

    const out = (await Admin.findById(admin._id).lean());
    delete out.password;
    res.status(201).json({ message: "Admin created", admin: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------- Create Driver ---------- */
exports.createDriver = async (req, res) => {
  try {
    const { driver_id, name, license_number, phone_number, email, password, assigned_bus_id, username } = req.body;

    if (!driver_id || !name || !license_number || !phone_number || !email || !password || !username) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    const exists = await Driver.findOne({ $or: [{ email }, { driver_id }, { username }] });
    if (exists) return res.status(400).json({ error: "Driver already exists (email, id, or username)" });

    // Phone number unique across roles
    const phoneExistsAdmin = await Admin.findOne({ phone_number });
    const phoneExistsDriver = await Driver.findOne({ phone_number });
    const phoneExistsParent = await Parent.findOne({ phone_number });
    if (phoneExistsAdmin || phoneExistsDriver || phoneExistsParent) {
      return res.status(400).json({ error: "Phone number already in use" });
    }

    let busObjectId = null;
    if (assigned_bus_id) {
      const bus = await Bus.findById(assigned_bus_id); 
      if (!bus) return res.status(400).json({ error: "Invalid bus_id provided" });
      busObjectId = bus._id;
    }

    const hashedPw = await bcrypt.hash(password, 10);
    const driver = new Driver({
      driver_id,
      name,
      license_number,
      phone_number,
      email,
      password: hashedPw,
      assigned_bus_id: assigned_bus_id ? new mongoose.Types.ObjectId(assigned_bus_id) : null,
      username
    });

    await driver.save();

    if (busObjectId) {
      await Bus.findByIdAndUpdate(busObjectId, { driver_id: driver._id });
    }

    const out = await Driver.findById(driver._id).populate("assigned_bus_id", "bus_id plate_number").lean();
    delete out.password;

    res.status(201).json({ message: "Driver created successfully", driver: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------- Create Parent ---------- */
exports.createParent = async (req, res) => { 
  try {
    const { parent_id, name, phone_number, email, password, children, username, home_address } = req.body;

    if (!parent_id || !name || !phone_number || !email || !password || !username || !home_address) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    const exists = await Parent.findOne({ $or: [{ email }, { parent_id }, { username }] });
    if (exists) return res.status(400).json({ error: "Parent already exists (email, id, or username)" });

    const phoneExistsAdmin = await Admin.findOne({ phone_number });
    const phoneExistsDriver = await Driver.findOne({ phone_number });
    const phoneExistsParent = await Parent.findOne({ phone_number });
    if (phoneExistsAdmin || phoneExistsDriver || phoneExistsParent) {
      return res.status(400).json({ error: "Phone number already in use" });
    }

    // Geocode home address
    let coords = null;
    try {
      const geoRes = await geocoder.forwardGeocode({
        query: home_address,
        limit: 1
      }).send();

      if (geoRes.body.features && geoRes.body.features.length > 0) {
        coords = geoRes.body.features[0].geometry.coordinates; // [lng, lat]
      } else {
        console.warn("No geocoding results for:", home_address);
      }
    } catch (e) {
      console.warn("Geocoding failed for:", home_address, e.message);
    }

    const hashedPw = await bcrypt.hash(password, 10);

    const parentData = {
      parent_id,
      name,
      phone_number,
      email,
      password: hashedPw,
      username,
      home_address
    };

    if (coords && Array.isArray(coords) && coords.length === 2) {
      parentData.home_coordinates = { type: "Point", coordinates: coords };
    }

    const parent = new Parent(parentData);
    await parent.save();

    // ✅ Generate QR cards for children if provided
    if (Array.isArray(children) && children.length > 0) {
      const savedChildren = await Promise.all(children.map(async (child) => {
        const student = new Student({
          student_id: generateStudentId(),
          name: child.name,
          parent_id: parent._id,
          assigned_bus_id: child.assigned_bus_id || null
        });

        // 🧠 Generate card with QR code and attach URL
        const cardUrl = await cardService.generateStudentCard(student);
        student.card_url = cardUrl;

        await student.save();
        return student._id;
      }));

      parent.children = savedChildren;
      await parent.save();
    }

    const out = await Parent.findById(parent._id).populate('children').lean();
    delete out.password;
    res.status(201).json({ message: "Parent account created successfully", parent: out });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* ---------- Get Accounts ---------- */
exports.getAccounts = async (req, res) => {
  try {
    const admins = await Admin.find().lean();
    const parents = await Parent.find().populate('children').lean();
    const drivers = await Driver.find().lean();

    const accounts = [];

    admins.forEach(a => accounts.push({
     _id: a._id, role: 'admin', id: a.admin_id, email: a.email, name: a.name, phone: a.phone_number || '', busId: null, students: []
    }));

    parents.forEach(p => {
      const students = (p.children || []).map(c => ({ student_id: c.student_id, name: c.name, assigned_bus_id: c.assigned_bus_id || null }));
      const busId = students.length > 0 ? students[0].assigned_bus_id : null;
      accounts.push({_id: p._id, role: 'parent', id: p.parent_id, email: p.email, name: p.name, phone: p.phone_number, busId, students });
    });

    drivers.forEach(d => accounts.push({ _id: d._id, role: 'driver', id: d.driver_id, email: d.email, name: d.name, phone: d.phone_number, busId: d.assigned_bus_id || null, students: [] }));

    res.json(accounts);
  } catch (err) {
    console.error("GetAccounts error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
};

/* ---------- Manage Children Feature ---------- */

// Get parent by ID (with children)
exports.getParentById = async (req, res) => {
  try {
    const { parentId } = req.params;
    const parent = await Parent.findById(parentId).populate("children").lean();
    if (!parent) return res.status(404).json({ error: "Parent not found" });

    delete parent.password;
    res.json(parent);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add child to parent
exports.addChildToParent = async (req, res) => {
  try {
    const { parentId } = req.params;
    const { name, student_id } = req.body;

    if (!name || !student_id) {
      return res.status(400).json({ error: "Name and student_id are required" });
    }

    const parent = await Parent.findById(parentId);
    if (!parent) return res.status(404).json({ error: "Parent not found" });

    // ✅ Create new student record
    const student = new Student({
      student_id,
      name,
      parent_id: parent._id
    });

    // 🧠 Generate a QR card right away (with empty bus & driver)
    const cardUrl = await cardService.generateStudentCard({
      student_id,
      name,
      assigned_bus_id: null,
      driver_name: "N/A"
    });

    // ✅ Attach the generated card URL and save
    student.card_url = cardUrl;
    await student.save();

    // Link student to parent
    parent.children.push(student._id);
    await parent.save();

    // Fetch updated parent with children info
    const updatedParent = await Parent.findById(parent._id)
      .populate("children")
      .lean();

    res.status(201).json({
      message: "Child added and QR card generated successfully",
      parent: updatedParent
    });
  } catch (err) {
    console.error("❌ Error generating student card:", err);
    res.status(500).json({ error: err.message });
  }
};


// Remove child from parent (student_id only)
exports.removeChildFromParent = async (req, res) => {
  try {
    const { parentId, childId } = req.params; // childId = student_id

    const parent = await Parent.findById(parentId);
    if (!parent) return res.status(404).json({ error: "Parent not found" });

    const student = await Student.findOne({ student_id: childId });
    if (!student) return res.status(404).json({ error: "Student not found" });

    parent.children = parent.children.filter(
      (c) => c.toString() !== student._id.toString()
    );
    await parent.save();

    //  Delete all attendance records linked to this student
    const Attendance = require("../../data/models/Attendance");
    await Attendance.deleteMany({ student_ref: student._id });

    await Student.deleteOne({ _id: student._id });

    res.json({ message: "Child and related attendance records removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


/* ---------- Update Password By Email ---------- */
exports.updatePasswordByEmail = async (req, res) => {
  try {
    const { role, email } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: "New password is required" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Pick the correct model based on role
    let model;
    if (role === "admin") model = Admin;
    else if (role === "driver") model = Driver;
    else if (role === "parent") model = Parent;
    else return res.status(400).json({ error: "Invalid role" });

    // Update account
    const account = await model.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("❌ Update password error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};


/* ---------- Delete Account By Email ---------- */
exports.deleteAccountByEmail = async (req, res) => {
  try {
    const { role, email } = req.params;

    let Model;
    if (role === "admin") Model = Admin;
    else if (role === "driver") Model = Driver;
    else if (role === "parent") Model = Parent;
    else return res.status(400).json({ error: "Invalid role" });

    // If deleting a parent, also remove their children (students)
    if (role === "parent") {
      const parent = await Parent.findOne({ email }).lean();
      if (!parent) return res.status(404).json({ error: "Account not found" });

      if (Array.isArray(parent.children) && parent.children.length > 0) {
        await Student.deleteMany({ _id: { $in: parent.children } });
      }

      await Parent.deleteOne({ _id: parent._id });
      return res.json({ message: "Account deleted successfully" });
    }

    const doc = await Model.findOneAndDelete({ email });
    if (!doc) return res.status(404).json({ error: "Account not found" });

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("❌ Delete account error:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
};


// Display qr code cards for all students
exports.getAllStudentsWithCards = async (req, res) => {
  try {
    // Fetch all students (each already has a card_url field)
    const students = await Student.find()
      .select("student_id name assigned_bus_id card_url")
      .lean();

    // Ensure URLs are accessible (start with /uploads)
    const formatted = students.map(s => ({
      student_id: s.student_id,
      name: s.name,
      assigned_bus_id: s.assigned_bus_id,
      card_url: s.card_url?.startsWith("/")
        ? s.card_url
        : s.card_url
        ? `/${s.card_url}`
        : null,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("getAllStudentsWithCards error:", err);
    res.status(500).json({ error: "Failed to fetch all students with cards" });
  }
};


// ====================== View Attendance Logs with Pagination ======================
exports.viewAttendanceLogs = async (req, res) => {
  try {
    // Pagination parameters (default: page 1, 20 logs per page)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination info
    const total = await Attendance.countDocuments();

    // Fetch paginated attendance logs
    const logs = await Attendance.find()
      .populate("student_ref", "student_id name")
      .populate("bus_ref", "bus_id plate_number")
      .sort({ scan_time: -1 })
      .skip(skip)
      .limit(limit);

    // Return data + pagination info
    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("Error fetching attendance logs:", err);
    res.status(500).json({
      success: false,
      message: "Server error while retrieving attendance logs",
    });
  }
};
