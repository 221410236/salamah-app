// tools/regenerateCards.js

require("dotenv").config();
const mongoose = require("mongoose");

// Load models
const Student = require("../data/models/Student");
const cardService = require("../application/services/cardService");

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("✅ Connected to DB");
  } catch (err) {
    console.error("❌ DB Connect Error:", err);
    process.exit();
  }
}

async function regenerateCards() {
  await connectDB();

  const students = await Student.find();
  console.log(`Found ${students.length} students`);

  for (const student of students) {
    try {
      console.log(`Generating card for: ${student.name} (${student.student_id})`);

      const cardUrl = await cardService.generateStudentCard(student);
      if (!cardUrl) {
        console.log(`❌ Failed for ${student.name}`);
        continue;
      }

      student.card_url = cardUrl;
      await student.save();

      console.log(`✅ Done: ${student.name}`);
    } catch (err) {
      console.error(`❌ Error generating card for ${student.name}:`, err);
    }
  }

  console.log("All student QR cards regenerated!");
  process.exit();
}

regenerateCards();