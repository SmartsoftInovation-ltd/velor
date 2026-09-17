const nodemailer = require("nodemailer");

// Credentials come from the environment only. Never hardcode them here.
let transporter = null;

const getMailConfig = () => {
  const user = process.env.HOST_MAIL;
  const pass = process.env.HOST_APP_PASSWORD;
  if (!user || !pass) return null;
  return { user, pass, fromName: process.env.MAIL_FROM_NAME || "" };
};

const getMailTransport = (config) => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: config.user, pass: config.pass },
    });
  }
  return transporter;
};

// Test hook: forget the cached transport so a new config takes effect
const resetMailTransport = () => {
  transporter = null;
};

/**
 * Sends an HTML email.
 * By default failures are logged and resolve to null (fire-and-forget callers);
 * pass { throwOnError: true } when the caller must surface the failure.
 */
const sendEmail = async (to, subject, template, { throwOnError = false } = {}) => {
  const config = getMailConfig();
  if (!config) {
    const error = new Error("Mail is not configured: set HOST_MAIL and HOST_APP_PASSWORD");
    if (throwOnError) throw error;
    console.error(error.message);
    return null;
  }

  try {
    const info = await getMailTransport(config).sendMail({
      from: config.fromName ? `${config.fromName} <${config.user}>` : config.user,
      to,
      subject,
      html: template,
    });

    console.log("Message sent:", info.messageId);
    return info.messageId;
  } catch (error) {
    if (throwOnError) throw error;
    console.error("Error sending email: ", error.message);
    return null;
  }
};

module.exports = { sendEmail, resetMailTransport };
