// application/controllers/busController.js
const Bus = require("../../data/models/Bus");
const Driver = require("../../data/models/Driver");
const Student = require("../../data/models/Student");
const Parent = require("../../data/models/Parent");
const mongoose = require("mongoose");

// Generate Unique Bus ID
async function generateBusId() {
  let busId;
  let exists = true;

  while (exists) {
    const randomNumbers = Math.floor(1000 + Math.random() * 9000);
    busId = `BUS${randomNumbers}`;

    // Check if the generated ID already exists in the DB
    const existingBus = await Bus.findOne({ bus_id: busId }).lean();
    exists = !!existingBus;
  }

  return busId;
}

// Create Bus
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


// Assign Students to Bus
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


exports.getStudents = async (req, res) => {
  try {
    const parents = await Parent.find()
      .populate({
      path: "children",
      populate: {
        path: "assigned_bus_id",
        select: "bus_id"
      }
    })
    .lean();

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
exports.generateBusId = async (req, res) => {
  try {
    const newBusId = await generateBusId(); // await because async
    res.json({ bus_id: newBusId });
  } catch (err) {
    console.error("Error generating bus ID:", err);
    res.status(500).json({ error: "Failed to generate bus ID" });
  }
};


// Delete Bus
exports.deleteBus = async (req, res) => {
  try {
    const { bus_id } = req.params;

    const bus = await Bus.findOne({ bus_id });
    if (!bus) return res.status(404).json({ error: "Bus not found" });

    if (bus.driver_id) {
      await Driver.findByIdAndUpdate(bus.driver_id, { assigned_bus_id: null });
    }
    await Student.updateMany(
      { assigned_bus_id: bus._id },
      { $set: { assigned_bus_id: null } }
    );
    await Bus.deleteOne({ _id: bus._id });

    res.json({
      message: "Bus deleted successfully — driver and students unassigned"
    });
  } catch (err) {
    console.error("deleteBus error:", err);
    res.status(500).json({ error: "Failed to delete bus" });
  }
};

// Unassign Driver From Bus
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

// Get Unassigned Drivers
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

// Assign Driver To Bus 
exports.assignDriverToBus = async (req, res) => {
  try {
    const { bus_id } = req.params;
    const { driverId } = req.body;

    // Find both documents
    const bus = await Bus.findOne({ bus_id });
    if (!bus) return res.status(404).json({ error: "Bus not found" });

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ error: "Driver not found" });

    // Make sure bus is empty
    if (bus.driver_id) {
      return res.status(400).json({ error: "This bus already has a driver" });
    }

    // Link both sides
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


// Required for admin Multi-bus map

exports.getAllBusLocations = async (req, res) => {
  try {
    const buses = await Bus.find({}, "bus_id plate_number last_lat last_lng").lean();
    res.json(buses);
  } catch (err) {
    console.error("getAllBusLocations error:", err);
    res.status(500).json({ error: "Failed to fetch bus locations" });
  }
};
