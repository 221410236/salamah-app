// application/services/emailService.js
const nodemailer = require("nodemailer");
const path = require("path");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,          // Gmail TLS port
  secure: false,      // MUST be false for port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // prevent TLS errors
  },
});

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"Salamah Notifications" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      attachments: [
        {
          filename: "salamah logo.png",
          path: path.join(__dirname, "../../presentation/images/salamah logo.png"),
          cid: "salamahlogo"
        }
      ]
    });
    console.log(`📧 Email sent to ${to}`);
  } catch (err) {
    console.error(" Failed to send email:", err);
  }
}

module.exports = { sendEmail };