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

// ---  Generate Bus ID ---
function generateBusId() {
  const randomNumbers = Math.floor(1000 + Math.random() * 9000); 
  return `BUS${randomNumbers}`;
}

// --- Helper: Generate Student ID ---
function generateStudentId() {
  const randomNumbers = Math.floor(10000 + Math.random() * 90000); 
  return `STU${randomNumbers}`;
}

exports.generateStudentId = (req, res) => {
  try {
    const newStudentId = generateStudentId();
    res.json({ student_id: newStudentId });
  } catch (err) {
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

    res.json({
      message: "Admin login successful",
      user: {
        _id: admin._id,
        admin_id: admin.admin_id,
        username: admin.username,
      }
    });
  } catch (err) {
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


/* ---------- Create Bus ---------- */
exports.createBus = async (req, res) => {
  try {
    const { bus_id, plate_number, capacity, driver_id } = req.body;

    if (!plate_number || !capacity) {
      return res.status(400).json({ error: "Plate number and capacity are required" });
    }

    // Generate ID if not provided
    const newBusId = bus_id || await generateBusId();

    // Check if bus already exists
    const exists = await Bus.findOne({ bus_id: newBusId });
    if (exists) {
      return res.status(400).json({ error: "Bus ID already exists" });
    }

    const bus = new Bus({
      bus_id: newBusId,
      plate_number,
      capacity,
      driver_id: driver_id || null
    });

    await bus.save();
    res.status(201).json({ message: "Bus created successfully", bus });
  } catch (err) {
    console.error("createBus error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Get Unassigned Buses for Driver Assignment
exports.getUnassignedBuses = async (req, res) => {
  try {
    const buses = await Bus.find({ driver_id: null }); // only unassigned buses
    res.json(
      buses.map(b => ({
        _id: b._id,                 
        bus_id: b.bus_id,           
        plate_number: b.plate_number,
        capacity: b.capacity
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch unassigned buses" });
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

    await Student.deleteOne({ _id: student._id });

    res.json({ message: "Child removed" });
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


/* ---------- Assign Students to Bus ---------- */
exports.assignStudentsToBus = async (req, res) => {
  try {
    const { bus_id, student_ids } = req.body;

    if (!bus_id || !Array.isArray(student_ids) || student_ids.length === 0) {
      return res.status(400).json({ error: "bus_id and student_ids[] are required" });
    }

    // check bus exists
    const bus = await Bus.findOne({ bus_id });
    if (!bus) return res.status(404).json({ error: "Bus not found" });

    // update each student
    const updated = await Promise.all(
      student_ids.map(async sid => {
        return await Student.findOneAndUpdate(
          { student_id: sid },
          { assigned_bus_id: bus._id },
          { new: true }
        ).lean();
      })
    );

    res.json({
      message: `Assigned ${updated.length} student(s) to bus ${bus_id}`,
      students: updated
    });
  } catch (err) {
    console.error("assignStudentsToBus error:", err);
    res.status(500).json({ error: err.message });
  }
};

// to fetch buses/students for UI
exports.getBuses = async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate("driver_id", "name email phone_number") // populate driver info
      .lean();

    res.json(
      buses.map(b => ({
        _id: b._id,
        bus_id: b.bus_id,
        plate_number: b.plate_number,
        capacity: b.capacity,
        driver: b.driver_id
          ? { _id: b.driver_id._id, name: b.driver_id.name, email: b.driver_id.email }
          : null
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch buses" });
  }
};


exports.getStudents = async (req, res) => {
  try {
    const parents = await Parent.find().populate("children").lean();

    // flatten all children
    const students = parents.flatMap(p =>
      (p.children || []).map(c => ({
        student_id: c.student_id,
        name: c.name,
        assigned_bus_id: c.assigned_bus_id || null
      }))
    );

    // filter unassigned
    const unassigned = students.filter(s => !s.assigned_bus_id);
    res.json(unassigned);
  } catch (err) {
    console.error("getStudents error:", err);
    res.status(500).json({ error: "Failed to fetch students" });
  }
};

// Generate Bus ID API
exports.generateBusId = (req, res) => {
  try {
    const newBusId = generateBusId();
    res.json({ bus_id: newBusId });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate bus ID" });
  }
};

// Delete Bus
exports.deleteBus = async (req, res) => {
  try {
    const { bus_id } = req.params;
    const bus = await Bus.findOneAndDelete({ bus_id });
    if (!bus) return res.status(404).json({ error: "Bus not found" });

    // If driver was assigned, unassign driver
    if (bus.driver_id) {
      await Driver.findByIdAndUpdate(bus.driver_id, { assigned_bus_id: null });
    }

    res.json({ message: "Bus deleted successfully" });
  } catch (err) {
    console.error("deleteBus error:", err);
    res.status(500).json({ error: "Failed to delete bus" });
  }
};

/* ---------- Unassign Driver From Bus ---------- */
exports.unassignDriverFromBus = async (req, res) => {
  try {
    const { bus_id } = req.params;

    // 1. Find bus by its friendly bus_id
    const bus = await Bus.findOne({ bus_id });
    if (!bus) return res.status(404).json({ error: "Bus not found" });

    // 2. Ensure it actually has a driver assigned
    if (!bus.driver_id) {
      return res.status(400).json({ error: "This bus currently has no assigned driver" });
    }

    // 3. Find the driver who is assigned to this bus
    const driver = await Driver.findById(bus.driver_id);
    if (driver) {
      driver.assigned_bus_id = null;
      await driver.save();
    }

    // 4. Remove driver link from bus
    bus.driver_id = null;
    await bus.save();

    console.log(`✅ Unassigned driver ${driver?.driver_id || ""} from bus ${bus.bus_id}`);

    res.json({ message: "Driver unassigned successfully" });
  } catch (err) {
    console.error("❌ unassignDriverFromBus error:", err);
    res.status(500).json({ error: err.message || "Failed to unassign driver" });
  }
};

/* ---------- Get Unassigned Drivers ---------- */
exports.getUnassignedDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find({ assigned_bus_id: null })
      .select("_id driver_id name email phone_number")
      .lean();

    res.json(drivers);
  } catch (err) {
    console.error("getUnassignedDrivers error:", err);
    res.status(500).json({ error: "Failed to fetch unassigned drivers" });
  }
};

/* ---------- Assign Driver To Bus ---------- */
exports.assignDriverToBus = async (req, res) => {
  try {
    const { bus_id } = req.params;
    const { driverId } = req.body;

    // 1️ Find both documents
    const bus = await Bus.findOne({ bus_id });
    if (!bus) return res.status(404).json({ error: "Bus not found" });

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    // 2️ Make sure bus is empty
    if (bus.driver_id) {
      return res.status(400).json({ error: "This bus already has a driver" });
    }

    // 3️ Link both sides
    bus.driver_id = driver._id;
    driver.assigned_bus_id = bus._id;

    await bus.save();
    await driver.save();

    console.log(`Assigned driver ${driver.driver_id} → bus ${bus.bus_id}`);
    res.json({ message: "Driver assigned successfully" });
  } catch (err) {
    console.error("assignDriverToBus error:", err);
    res.status(500).json({ error: "Failed to assign driver" });
  }
};



// Get only available buses (driver assigned & not full)
exports.getAvailableBuses = async (req, res) => {
  try {
    const buses = await Bus.find({ driver_id: { $ne: null } })
      .populate("driver_id", "name email phone_number")
      .populate({
        path: "students",
        select: "student_id name assigned_bus_id"
      })
      .lean();

    // filter: has driver & not full
    const available = buses.filter(b => {
      const assignedCount = b.students ? b.students.length : 0;
      return assignedCount < b.capacity;
    });

    res.json(
      available.map(b => ({
        _id: b._id,
        bus_id: b.bus_id,
        plate_number: b.plate_number,
        capacity: b.capacity,
        assignedCount: b.students?.length || 0,
        driver: b.driver_id ? b.driver_id.name : "Unassigned"
      }))
    );
  } catch (err) {
    console.error("getAvailableBuses error:", err);
    res.status(500).json({ error: "Failed to fetch available buses" });
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
