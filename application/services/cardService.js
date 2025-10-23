// application/services/cardService.js
const QRCode = require('qrcode');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = path.join(__dirname, '../../presentation/images/salamah logo.png');
const OUTPUT_DIR = path.join(process.cwd(), 'uploads/cards');

// Ensure the output folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
/**
 * 🪄 generateStudentCard(student)
 * Builds a PNG card with:
 *  - Salamah logo (optional)
 *  - Student name + ID + bus + driver
 *  - QR code
 * Returns: relative URL (e.g. /uploads/cards/student_<id>.png)
 */
async function generateStudentCard(student) {
  try {
    // Create the QR code
    const qrData = JSON.stringify({ student_id: student.student_id });
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 300 });

    // Base card: 800x500 white background
    const base = {
      create: {
        width: 800,
        height: 500,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    };

    // SVG overlay for text
    const textSvg = `
    <svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
      <style>
        .header { font-size: 36px; font-weight: bold; fill: #000; font-family: 'Arial', sans-serif; }
        .label  { font-size: 26px; fill: #444; font-family: 'Arial', sans-serif; }
        .value  { font-size: 28px; fill: #000; font-family: 'Arial', sans-serif; font-weight: bold; }
        .footer { font-size: 22px; fill: #777; font-family: 'Arial', sans-serif; }
        .bg { fill: #fff8e6; }
        .border { fill: none; stroke: #ffcc00; stroke-width: 8; rx: 20; ry: 20; }
      </style>

      <!-- Background + border -->
      <rect width="800" height="500" class="bg"/>
      <rect x="10" y="10" width="780" height="480" class="border"/>

      <!-- Header -->
      <text x="250" y="80" class="header">Salamah Student ID</text>

       <!-- Labels and values (shifted slightly lower for better balance) -->
      <text x="380" y="230" class="label">Name:</text>
      <text x="520" y="230" class="value">${student.name}</text>

      <text x="380" y="290" class="label">Student ID:</text>
      <text x="520" y="290" class="value">${student.student_id}</text>


    </svg>
    `;



    // Load logo
    const logoOverlay = fs.existsSync(LOGO_PATH)
      ? await sharp(LOGO_PATH).resize(100, 100).png().toBuffer()
      : null;

    // Combine layers
    const composite = [
      { input: Buffer.from(textSvg), top: 0, left: 0 },
      { input: qrBuffer, top: 150, left: 50 },
    ];
    if (logoOverlay) composite.push({ input: logoOverlay, top: 20, left: 50 });

    // Save final image
    const fileName = `student_${student._id}.png`;
    const outputPath = path.join(OUTPUT_DIR, fileName);

    await sharp(base).composite(composite).png().toFile(outputPath);

    // Return accessible URL for use in frontend
    return `/uploads/cards/${fileName}`;
  } catch (err) {
    console.error('❌ Card generation error:', err);
    return null;
  }
}

module.exports = { generateStudentCard };
