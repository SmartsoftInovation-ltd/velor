const axios = require("axios");
const { getSmsConfig } = require("../integrations/config");

// Sends through the current tenant's SMS provider (or the legacy env account)
async function sendSMS(numbers, message) {
  const numberList = Array.isArray(numbers) ? numbers.filter(Boolean).join(",") : numbers;
  if (!numberList) throw new Error("At least one phone number is required");

  const { apiUrl, apiKey, senderId } = await getSmsConfig();
  if (!apiUrl || !apiKey || !senderId) {
    throw new Error("SMS provider is not configured");
  }

  try {
    const { data } = await axios.post(apiUrl, {
      api_key: apiKey,
      senderid: senderId,
      number: numberList,
      message,
    });
    // BulkSMSBD answers HTTP 200 even when it rejects the message; 202 is "accepted"
    if (data?.response_code !== undefined && Number(data.response_code) !== 202) {
      console.error("❌ SMS rejected by provider:", data);
    } else {
      console.log("✅ SMS Sent Successfully:", data);
    }
    return data;
  } catch (error) {
    console.error("❌ Error sending SMS:", error.response?.data || error.message);
    throw error;
  }
}

async function getSmsBalance() {
  const { balanceUrl, apiKey } = await getSmsConfig();
  if (!apiKey) throw new Error("SMS provider is not configured");
  const { data } = await axios.get(balanceUrl, { params: { api_key: apiKey } });
  return data;
}

module.exports = { sendSMS, getSmsBalance };
