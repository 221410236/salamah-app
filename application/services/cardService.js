// application/services/cardService.js

const cloudinary = require("./cloudinary");
const QRCode = require("qrcode");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const LOGO_PATH = path.join(__dirname, "../../presentation/images/salamah logo.png");

/**
 * 🪄 generateStudentCard(student)
 * - Creates QR code
 * - Adds student name, ID, border, logo
 * - Uploads final PNG to Cloudinary
 * - Returns Cloudinary URL
 */
async function generateStudentCard(student) {
  try {
    // Generate QR code
    const qrData = JSON.stringify({ student_id: student.student_id });
    const qrBuffer = await QRCode.toBuffer(qrData, { width: 300 });

    // Base card
    const base = {
      create: {
        width: 800,
        height: 500,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    };

    // Full styled SVG
    const textSvg = `
<svg width="800" height="500" xmlns="http://www.w3.org/2000/svg">
  <style>
    .header { font-size: 36px; font-weight: bold; fill: #000; font-family: Arial, sans-serif; }
    .label  { font-size: 26px; fill: #444; font-family: Arial, sans-serif; }
    .value  { font-size: 28px; fill: #000; font-family: Arial, sans-serif; font-weight: bold; }
    .bg { fill: #fff8e6; }
    .border { fill: none; stroke: #ffcc00; stroke-width: 8; rx: 20; ry: 20; }
  </style>

  <!-- Background -->
  <rect width="800" height="500" class="bg"/>

  <!-- Border -->
  <rect x="10" y="10" width="780" height="480" class="border"/>

  <!-- Header -->
  <text x="230" y="80" class="header">Salamah Student ID</text>

  <!-- Fields -->
  <text x="380" y="230" class="label">Name:</text>
  <text x="520" y="230" class="value">${student.name}</text>

  <text x="380" y="290" class="label">Student ID:</text>
  <text x="520" y="290" class="value">${student.student_id}</text>
</svg>
`;

    // Add logo if available
    const logoOverlay = fs.existsSync(LOGO_PATH)
      ? await sharp(LOGO_PATH).resize(100, 100).png().toBuffer()
      : null;

    // Composite layers
    const composite = [
      { input: Buffer.from(textSvg), top: 0, left: 0 },
      { input: qrBuffer, top: 150, left: 50 },
    ];

    if (logoOverlay) composite.push({ input: logoOverlay, top: 20, left: 50 });

    // TEMP LOCAL FILE
    const tempPath = path.join(__dirname, `temp_${student._id}.png`);
    await sharp(base).composite(composite).png().toFile(tempPath);

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(tempPath, {
      folder: "salamah_qrcards",
      public_id: `student_${student._id}`,
      overwrite: true,
    });

    // Cleanup
    fs.unlinkSync(tempPath);

    // Return cloud URL
    return uploadResult.secure_url;

  } catch (err) {
    console.error("❌ Card generation error:", err);
    return null;
  }
}

module.exports = { generateStudentCard };