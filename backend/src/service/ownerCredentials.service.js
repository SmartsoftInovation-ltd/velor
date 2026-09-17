const { platformSmsAvailable, sendPlatformSms } = require("./platformSms.service");

const loginUrlFor = (slug) => {
  const appUrl = (process.env.APP_URL || process.env.DASHBOARD_URL || "").replace(/\/+$/, "");
  return `${appUrl}/signin?workspace=${slug}`;
};

const HEADLINES = {
  created: (store) => `Your store "${store}" is ready.`,
  password: (store) => `Your password for "${store}" was changed by support.`,
};

const smsText = ({ tenant, owner, password, reason }) =>
  [
    HEADLINES[reason](tenant.name),
    `Login: ${loginUrlFor(tenant.slug)}`,
    `Workspace: ${tenant.slug}`,
    `Email or phone: ${owner.email} / ${owner.phone}`,
    `Password: ${password}`,
  ].join("\n");

/**
 * Sends the owner their sign-in details by SMS through the platform account.
 * Never throws — the store and password are already saved.
 *
 * @param {{ tenant, owner, password, reason: "created" | "password" }} input
 * @returns {Promise<{ channel: "sms" | null, sent: boolean }>}
 */
const sendOwnerCredentials = async (input) => {
  if (!platformSmsAvailable() || !input.owner.phone) return { channel: null, sent: false };
  try {
    await sendPlatformSms(input.owner.phone, smsText(input));
    return { channel: "sms", sent: true };
  } catch (error) {
    console.error("Owner credentials SMS failed:", error.message);
    return { channel: "sms", sent: false };
  }
};

module.exports = { sendOwnerCredentials, loginUrlFor };
