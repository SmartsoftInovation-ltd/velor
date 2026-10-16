const axios = require("axios");
const nodemailer = require("nodemailer");
const SSLCommerzPayment = require("sslcommerz-lts");
const cloudinary = require("cloudinary").v2;
const PathaoAuth = require("../service/couriers/PathaoAuth");
const { SECTIONS } = require("./definitions");

// Live credential checks for "Test" buttons in the platform console.
// Each tester receives the decrypted section and returns a small, secret-free detail.

const isEmpty = (value) => value === undefined || value === null || value === "";

const TESTERS = {
  sms: async (s) => {
    const { data } = await axios.get(s.balanceUrl || "http://bulksmsbd.net/api/getBalanceApi", { params: { api_key: s.apiKey } });
    if (data?.error) throw new Error(String(data.error));
    return data;
  },

  email: async (s) => {
    if (s.mode !== "smtp") throw new Error("Email is disabled");
    await nodemailer
      .createTransport({ host: s.smtpHost, port: s.smtpPort, secure: s.smtpSecure, auth: { user: s.smtpUser, pass: s.smtpPassword } })
      .verify();
    return { mode: s.mode };
  },

  sslcommerz: async (s) => {
    const sslcz = new SSLCommerzPayment(s.storeId, s.storePassword, s.isLive);
    const response = await sslcz.init({
      total_amount: 10,
      currency: "BDT",
      tran_id: `TEST-${Date.now()}`,
      success_url: "https://example.com/success",
      fail_url: "https://example.com/fail",
      cancel_url: "https://example.com/cancel",
      cus_name: "Connection Test",
      cus_email: "customer@example.com",
      cus_add1: "Dhaka",
      cus_phone: "01700000000",
      shipping_method: "NO",
      product_name: "Connection test",
      product_category: "Test",
      product_profile: "general",
    });
    if (response?.status !== "SUCCESS") throw new Error(response?.failedreason || "SSLCommerz rejected the store credentials");
    return { isLive: s.isLive };
  },

  pathao: async (s) => {
    let issued = null;
    const auth = new PathaoAuth(
      { merchantID: s.clientId, merchantSecret: s.clientSecret, baseURL: s.baseUrl, username: s.username, password: s.password },
      { get: async () => null, set: async (tokens) => { issued = tokens; } },
    );
    await auth.issueToken();
    return { tokenIssued: Boolean(issued?.access_token) };
  },

  steadfast: async (s) => {
    const { data } = await axios.get(`${s.baseUrl.replace(/\/+$/, "")}/get_balance`, {
      headers: { "Api-Key": s.apiKey, "Secret-Key": s.secretKey },
    });
    if (data?.status !== 200) throw new Error(data?.message || "Steadfast rejected the credentials");
    return { current_balance: data.current_balance };
  },

  cloudinary: async (s) => {
    const result = await cloudinary.api.ping({ cloud_name: s.cloudName, api_key: s.apiKey, api_secret: s.apiSecret });
    return { status: result?.status };
  },
};

const requiredFor = (sectionKey, values) => {
  if (sectionKey === "email" && values.mode !== "smtp") return [];
  return Object.entries(SECTIONS[sectionKey].fields)
    .filter(([name, field]) => field.required && isEmpty(values[name]))
    .map(([name]) => name);
};

// Provider messages can echo what was sent; never let a secret through
const scrub = (message, values, sectionKey) =>
  Object.entries(SECTIONS[sectionKey].fields)
    .filter(([name, field]) => field.type === "secret" && values[name])
    .reduce((text, [name]) => text.split(values[name]).join("***"), message);

const hasTester = (sectionKey) => Boolean(TESTERS[sectionKey]);

const runSettingsTest = async (sectionKey, values) => {
  const missing = requiredFor(sectionKey, values);
  if (missing.length) return { ok: false, error: `Missing ${missing.join(", ")}` };

  try {
    return { ok: true, detail: await TESTERS[sectionKey](values) };
  } catch (error) {
    // Cloudinary rejects with a plain { error: { message, http_code } }, not an Error
    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.error?.message ||
      error.message ||
      "Test failed";
    return { ok: false, error: scrub(String(message), values, sectionKey) };
  }
};

module.exports = { runSettingsTest, hasTester };
