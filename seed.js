require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Admin = require("../../data/models/Admin");
const Parent = require("../../data/models/Parent");
const Driver = require("../../data/models/Driver");
const Student = require("../../data/models/Student");
const Bus = require("../../data/models/Bus");

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    // Clean old data
    await Promise.all([
      Admin.deleteMany(),
      Driver.deleteMany(),
      Parent.deleteMany(),
      Student.deleteMany(),
      Bus.deleteMany()
    ]);

    // ===== Admin =====
    const admin = new Admin({
      admin_id: "admin1",
      name: "Khalid Manager",
      username: "admin",
      email: "admin@salamah.com",
      password: await bcrypt.hash("admin123", 10),
    });
    await admin.save();
    console.log(" Admin created:", admin.name);

    // ===== Drivers =====
    const driver1 = new Driver({
      driver_id: "driver1",
      name: "Omar Alqahtani",
      username: "d.omar",
      license_number: "LIC12345",
      phone_number: "0501111111",
      email: "omar.driver@salamah.com",
      password: await bcrypt.hash("driver123", 10),
    });
    const driver2 = new Driver({
      driver_id: "driver2",
      name: "Fahad Alharbi",
      username: "d.fahad",
      license_number: "LIC67890",
      phone_number: "0502222222",
      email: "fahad.driver@salamah.com",
      password: await bcrypt.hash("driver123", 10),
    });
    await driver1.save();
    await driver2.save();
    console.log(" Drivers created");

    // ===== Buses =====
    const bus1 = new Bus({
      bus_id: "bus1",
      plate_number: "ABC-1234",
      capacity: 30,
      driver_id: driver1._id,
    });
    const bus2 = new Bus({
      bus_id: "bus2",
      plate_number: "XYZ-5678",
      capacity: 25,
      driver_id: driver2._id,
    });
    await bus1.save();
    await bus2.save();

    // Assign buses to drivers
    driver1.assigned_bus_id = bus1._id;
    driver2.assigned_bus_id = bus2._id;
    await driver1.save();
    await driver2.save();

    // ===== Parents & Students =====
    const parent1 = new Parent({
      parent_id: "parent1",
      name: "Nora Alsaud",
      username: "p.nora",
      email: "nora.parent@salamah.com",
      phone_number: "055000001",
      password: await bcrypt.hash("parent123", 10),
    });
    await parent1.save();

    const student1 = new Student({
      student_id: "student1",
      name: "Yousef Alsaud",
      parent_id: parent1._id,
      assigned_bus_id: bus1._id,
    });
    await student1.save();

    parent1.children = [student1._id];
    await parent1.save();

    //  Add more parents/students as before (unchanged logic)

    console.log(" Parents and Students created");

    mongoose.connection.close();
    console.log(" Seeding done!");
  } catch (err) {
    console.error(" Error seeding data:", err);
    mongoose.connection.close();
  }
}

seed();
