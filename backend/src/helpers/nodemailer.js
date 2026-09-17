const nodemailer = require("nodemailer");
const integrationConfig = require("../integrations/config");

// One transport per distinct configuration (tenants may bring their own SMTP)
const transports = new Map();

const getMailTransport = (transportOptions) => {
  const key = JSON.stringify(transportOptions);
  if (!transports.has(key)) transports.set(key, nodemailer.createTransport(transportOptions));
  return transports.get(key);
};

// Test hook: forget cached transports so a new config takes effect
const resetMailTransport = () => transports.clear();

/**
 * Sends an HTML email with the current tenant's mail settings (or the legacy
 * env sender). By default failures are logged and resolve to null; pass
 * { throwOnError: true } when the caller must surface the failure.
 */
const sendEmail = async (to, subject, template, { throwOnError = false } = {}) => {
  try {
    const config = await integrationConfig.getMailConfig();
    if (!config) throw new Error("Mail is not configured: set up SMTP in Store Settings → Email");

    const info = await getMailTransport(config.transport).sendMail({
      from: config.from,
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
