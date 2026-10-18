const request = require("supertest");

/**
 * A supertest client bound to the app, optionally signed in and naming a store.
 *
 *   const client = api(app.server, { token, tenant: "pizzashop" });
 *   await client.get("/api/v1/sales/get-sales").expect(200);
 */
const BASE = "/api/v1";

const api = (server, { token, tenant, headers = {} } = {}) => {
  const wrap = (method) => (url) => {
    let req = request(server)[method](url.startsWith("/api/") || url.startsWith("/healthz") ? url : `${BASE}${url}`);
    if (token) req = req.set("Authorization", `Bearer ${token}`);
    if (tenant) req = req.set("x-tenant", tenant);
    for (const [k, v] of Object.entries(headers)) req = req.set(k, v);
    return req;
  };
  return {
    get: wrap("get"),
    post: wrap("post"),
    put: wrap("put"),
    patch: wrap("patch"),
    delete: wrap("delete"),
    request: (method, url) => wrap(method.toLowerCase())(url),
  };
};

// The two response envelopes the API uses (src/utils/apiResponse.js and
// src/lib/GlobalErrorHandeler.js). Kept here so every test asserts the same shape.
const expectSuccessEnvelope = (body) => {
  expect(body).toEqual(expect.objectContaining({ status: "OK", statusCode: expect.any(Number), message: expect.any(String) }));
};

const expectErrorEnvelope = (body, statusCode) => {
  expect(body).toEqual(expect.objectContaining({ message: expect.any(String) }));
  if (statusCode) expect(body.statusCode).toBe(statusCode);
  expect(JSON.stringify(body)).not.toMatch(/errorStack|\bat .+\.js:\d+/);
};

module.exports = { api, BASE, expectSuccessEnvelope, expectErrorEnvelope };
