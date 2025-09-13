// controllers/adminController.js
const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const Parent = require("../models/Parent");
const Driver = require("../models/Driver");
const Student = require("../models/Student");

// Admin login
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username });
    if (!admin) return res.status(400).json({ error: "Invalid username" });

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    res.json({
      message: "Admin login successful",
      admin_id: admin.admin_id,
      username: admin.username,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create Parent with children (kept & hardened)
exports.createParent = async (req, res) => {
  try {
    const { parent_id, name, phone_number, email, password, children } = req.body;
    // children = array of { student_id, name, assigned_bus_id? }

    if (!parent_id || !name || !phone_number || !email || !password) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    const exists = await Parent.findOne({ $or: [{ email }, { parent_id }] });
    if (exists) return res.status(400).json({ error: "Parent already exists (email or id)" });

    const hashedPw = await bcrypt.hash(password, 10);
    const parent = new Parent({ parent_id, name, phone_number, email, password: hashedPw });
    await parent.save();

    // Save children and link to parent
    if (Array.isArray(children) && children.length > 0) {
      const savedChildren = await Promise.all(children.map(async (child) => {
        const student = new Student({
          student_id: child.student_id,
          name: child.name,
          parent_id: parent._id,
          assigned_bus_id: child.assigned_bus_id || null
        });
        await student.save();
        return student._id;
      }));

      parent.children = savedChildren;
      await parent.save();
    }

    // return parent without password
    const out = await Parent.findById(parent._id).populate('children').lean();
    delete out.password;

    res.status(201).json({ message: "Parent account created successfully", parent: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create Driver (accept optional assigned_bus_id)
exports.createDriver = async (req, res) => {
  try {
    const { driver_id, name, license_number, phone_number, email, password, assigned_bus_id } = req.body;

    if (!driver_id || !name || !license_number || !phone_number || !email || !password) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    const exists = await Driver.findOne({ $or: [{ email }, { driver_id }] });
    if (exists) return res.status(400).json({ error: "Driver already exists (email or id)" });

    const hashedPw = await bcrypt.hash(password, 10);
    const driver = new Driver({ driver_id, name, license_number, phone_number, email, password: hashedPw, assigned_bus_id: assigned_bus_id || null });
    await driver.save();

    const out = (await Driver.findById(driver._id).lean());
    delete out.password;
    res.status(201).json({ message: "Driver account created successfully", driver: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Create Admin
exports.createAdmin = async (req, res) => {
  try {
    const { admin_id, name, email, password } = req.body;
    if (!admin_id || !name || !email || !password) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }
    const exists = await Admin.findOne({ $or: [{ email }, { admin_id }] });
    if (exists) return res.status(400).json({ error: "Admin already exists (email or id)" });

    const hashedPw = await bcrypt.hash(password, 10);
    const admin = new Admin({ admin_id, name, email, password: hashedPw });
    await admin.save();

    const out = (await Admin.findById(admin._id).lean());
    delete out.password;
    res.status(201).json({ message: "Admin created", admin: out });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all accounts (return unified list)
exports.getAccounts = async (req, res) => {
  try {
    // Load admins, parents (with children populated), drivers
    const admins = await Admin.find().lean();
    const parents = await Parent.find().populate('children').lean();
    const drivers = await Driver.find().lean();

    const accounts = [];

    admins.forEach(a => {
      accounts.push({
        role: 'admin',
        id: a.admin_id,
        email: a.email,
        name: a.name,
        phone: a.phone_number || '',
        busId: null,
        students: []
      });
    });

    parents.forEach(p => {
      const students = (p.children || []).map(c => ({
        student_id: c.student_id,
        name: c.name,
        assigned_bus_id: c.assigned_bus_id || null
      }));
      // pick busId from first student if available
      const busId = students.length > 0 ? students[0].assigned_bus_id : null;

      accounts.push({
        role: 'parent',
        id: p.parent_id,
        email: p.email,
        name: p.name,
        phone: p.phone_number,
        busId,
        students
      });
    });

    drivers.forEach(d => {
      accounts.push({
        role: 'driver',
        id: d.driver_id,
        email: d.email,
        name: d.name,
        phone: d.phone_number,
        busId: d.assigned_bus_id || null,
        students: []
      });
    });

    res.json(accounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update password by role and email
exports.updatePasswordByEmail = async (req, res) => {
  try {
    const { role, email } = req.params;
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "Password required" });

    let Model;
    if (role === 'admin') Model = Admin;
    else if (role === 'parent') Model = Parent;
    else if (role === 'driver') Model = Driver;
    else return res.status(400).json({ error: "Invalid role" });

    const hashed = await bcrypt.hash(password, 10);
    const updated = await Model.findOneAndUpdate({ email }, { password: hashed }, { new: true });
    if (!updated) return res.status(404).json({ error: "Account not found" });

    res.json({ message: "Password updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete account by role and email
exports.deleteAccountByEmail = async (req, res) => {
  try {
    const { role, email } = req.params;

    if (!role || !email) return res.status(400).json({ error: "Role and email required" });

    if (role === 'admin') {
      const removed = await Admin.findOneAndDelete({ email });
      if (!removed) return res.status(404).json({ error: "Admin not found" });
      return res.json({ message: "Admin deleted" });
    }

    if (role === 'driver') {
      const removed = await Driver.findOneAndDelete({ email });
      if (!removed) return res.status(404).json({ error: "Driver not found" });
      return res.json({ message: "Driver deleted" });
    }

    if (role === 'parent') {
      const parent = await Parent.findOne({ email });
      if (!parent) return res.status(404).json({ error: "Parent not found" });

      // Remove children (students) that reference this parent
      try {
        // children might be ObjectId array or simple reference
        if (Array.isArray(parent.children) && parent.children.length > 0) {
          await Student.deleteMany({ _id: { $in: parent.children } });
        } else {
          await Student.deleteMany({ parent_id: parent._id });
        }
      } catch (e) {
        // continue anyway
        console.warn("Failed to delete children:", e.message);
      }

      await Parent.deleteOne({ _id: parent._id });
      return res.json({ message: "Parent and children deleted" });
    }

    return res.status(400).json({ error: "Invalid role" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
