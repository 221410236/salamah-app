require("dotenv").config();
const mongoose = require("mongoose");
const Student = require("../data/models/Student");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const students = await Student.find();

  for (const s of students) {
    if (s.card_url?.startsWith("/https://")) {
      s.card_url = s.card_url.replace("/https://", "https://");
      await s.save();
      console.log("Fixed:", s.name);
    }
  }

  console.log("Done fixing URLs");
  process.exit();
})();
