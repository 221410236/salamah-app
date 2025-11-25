const sgMail = require("@sendgrid/mail");
const path = require("path");
const fs = require("fs");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail(to, subject, html) {
  try {
    const logoPath = path.join(
      __dirname,
      "../../presentation/images/salamah logo.png"   // <-- your exact file name
    );

    const msg = {
      to,
      from: process.env.EMAIL_FROM,
      subject,
      html,
      attachments: [
        {
          filename: "salamah-logo.png",
          type: "image/png",
          disposition: "inline",
          content_id: "salamahlogo",
          content: fs.readFileSync(logoPath).toString("base64"),
        },
      ],
    };

    await sgMail.send(msg);
    console.log(`📧 Email sent to ${to}`);

  } catch (err) {
    console.error("❌ SendGrid email error:", err.response?.body || err);
  }
}

module.exports = { sendEmail };
