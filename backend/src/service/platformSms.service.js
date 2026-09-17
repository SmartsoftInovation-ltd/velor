const { runAsPlatform } = require("../tenancy/context");
const { sendSMS } = require("../helpers/sms");

// The platform's own SMS account (.env), used for the one message that cannot go
// through a store's settings: the sign-in details a new store's owner receives,
// sent at a moment when that store has no SMS configured yet. Everything a store
// sends afterwards — including password reset codes — uses its own SMS settings.
const platformSmsAvailable = () =>
  Boolean(process.env.BULK_SMS_URL && process.env.BULK_SMS_API_KEY && process.env.BULK_SMS_SENDER_ID);

// Throws when the provider rejects the message
const sendPlatformSms = async (number, message) => {
  const data = await runAsPlatform(() => sendSMS(number, message));
  // BulkSMSBD answers HTTP 200 with its own status code; 202 means accepted
  if (data?.response_code !== undefined && Number(data.response_code) !== 202) {
    throw new Error(data.error_message || `SMS provider responded with ${data.response_code}`);
  }
  return data;
};

module.exports = { platformSmsAvailable, sendPlatformSms };
