const { runAsPlatform } = require("../tenancy/context");
const { sendSMS } = require("../helpers/sms");

// Account messages (sign-in details, password reset codes) go through the
// platform's own SMS account (.env), never a store's: a new store has no SMS
// settings yet, and a store's broken SMS setup must not lock its staff out.
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
