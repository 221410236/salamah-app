//application/controllers/parentController.js
const path = require("path"); 
const bcrypt = require("bcryptjs");
const Parent = require("../../data/models/Parent");
const Student = require("../../data/models/Student");

exports.loginParent = async (req, res) => {
  try {
    const { username, password } = req.body;

    // ✅ Populate children, their bus, and driver info
    const parent = await Parent.findOne({ username })
      .populate({
        path: "children",
        populate: {
          path: "assigned_bus_id",
          model: "Bus",
          populate: {
            path: "driver_id",
            model: "Driver",
          },
        },
      });

    if (!parent) return res.status(400).json({ error: "Invalid username" });

    const match = await bcrypt.compare(password, parent.password);
    if (!match) return res.status(400).json({ error: "Invalid password" });

    // ✅ Return all needed info safely to frontend
    res.json({
      message: "Parent login successful",
      user: {
        _id: parent._id,
        parent_id: parent.parent_id,
        username: parent.username,
        children: parent.children.map((child) => ({
          _id: child._id,
          name: child.name,
          student_id: child.student_id,
          card_url: child.card_url,
          assigned_bus_id: child.assigned_bus_id
            ? {
                plate_number: child.assigned_bus_id.plate_number || null,
                bus_id: child.assigned_bus_id.bus_id || null,
                driver_id: child.assigned_bus_id.driver_id
                  ? {
                      username: child.assigned_bus_id.driver_id.username || null,
                      phone_number:
                        child.assigned_bus_id.driver_id.phone_number || "-",
                    }
                  : null,
              }
            : null,
        })),
      },
    });
  } catch (err) {
    console.error("Parent login error:", err);
    res.status(500).json({ error: err.message });
  }
};


exports.getQrCards = async (req, res) => {
  try {
    const parentId = req.params.id;

    const students = await Student.find({ parent_id: parentId })
      .select("student_id name card_url");

    const cards = students.map(s => {
      let url = s.card_url;
      const localPath = path.join(__dirname, "../../uploads/cards", `${s.student_id}.png`);

      // If the DB doesn’t have the card_url but the file exists, auto-link it
      if (!url && fs.existsSync(localPath)) {
        url = `/uploads/cards/${s.student_id}.png`;
      }

      return {
        student_id: s.student_id,
        name: s.name,
        card_url: url,
      };
    });

    res.json(cards);
  } catch (err) {
    console.error("Error fetching QR cards:", err);
    res.status(500).json({ message: "Failed to load QR cards" });
  }
};