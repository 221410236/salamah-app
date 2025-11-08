// application/services/absenceStore.js


// Simple in-memory absence tracker (resets daily)
const absences = new Map();


// Mark a Student as Absent
exports.markAbsent = (studentId) => {
  absences.set(studentId, { date: new Date().toDateString() });
  console.log(` Student ${studentId} marked absent`);
};

// Check if a Student is Absent Today
exports.isAbsent = (studentId) => {
  const record = absences.get(studentId);
  return record && record.date === new Date().toDateString();
};

// Get All Absences for Today
exports.getAllAbsences = () => {
  const today = new Date().toDateString();
  return Array.from(absences.entries())
    .filter(([_, v]) => v.date === today)
    .map(([id]) => id);
};


// Daily Reset at Midnight
setInterval(() => {
  absences.clear();
  console.log("Daily absence records cleared");
}, 24 * 60 * 60 * 1000);
