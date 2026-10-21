const jwt = require("jsonwebtoken");
const Joi = require("joi");
const mongoose = require("mongoose");
const { globalErrorHandeler } = require("../../src/lib/GlobalErrorHandeler");
const { customError } = require("../../src/lib/CustomError");

// The one place every error becomes a response: each error type must map to
// the right status and the standard shape, and nothing internal may leak.
describe("globalErrorHandeler", () => {
  const envBackup = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = envBackup;
  });
  beforeAll(() => jest.spyOn(console, "log").mockImplementation(() => {}));
  afterAll(() => jest.restoreAllMocks());

  const handle = (error, nodeEnv = "production") => {
    if (nodeEnv === "UNSET") delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    const res = { statusCode: null, body: null };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      res.body = body;
      return res;
    };
    globalErrorHandeler(error, {}, res, () => {});
    return res;
  };

  it("passes a customError through with its status, message and code", () => {
    const res = handle(new customError("Nope", 409, "THING_TAKEN"));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ statusCode: 409, message: "Nope", code: "THING_TAKEN" });
  });

  it("maps an expired JWT to 401 'Access token expired' (the client refreshes on 401)", () => {
    let err;
    try {
      jwt.verify(jwt.sign({ a: 1 }, "s", { expiresIn: -10 }), "s");
    } catch (e) {
      err = e;
    }
    expect(handle(err)).toMatchObject({ statusCode: 401, body: { message: "Access token expired" } });
  });

  it.each([
    ["a bad signature", () => jwt.verify(jwt.sign({ a: 1 }, "s"), "other")],
    ["a malformed token", () => jwt.verify("abc", "s")],
    ["a not-yet-valid token", () => jwt.verify(jwt.sign({ a: 1 }, "s", { notBefore: 60 }), "s")],
  ])("maps %s to 401 'Invalid token'", (_name, fn) => {
    let err;
    try {
      fn();
    } catch (e) {
      err = e;
    }
    expect(handle(err)).toMatchObject({ statusCode: 401, body: { message: "Invalid token" } });
  });

  it("maps a duplicate-key error to 400 with a readable message", () => {
    const err = Object.assign(new Error("E11000 duplicate key error collection: t.accounts index: slug_1 dup key: { slug: \"bank\" }"), {
      code: 11000,
      keyPattern: { slug: 1 },
      keyValue: { slug: "bank" },
    });
    expect(handle(err)).toMatchObject({ statusCode: 400, body: { message: 'slug "bank" already exists' } });
  });

  it("reads field and value out of a wrapped duplicate-key message", () => {
    const err = new Error('Plan executor error :: caused by :: E11000 duplicate key error collection: t.x index: code_1 dup key: { code: "SAVE10" }');
    expect(handle(err)).toMatchObject({ statusCode: 400, body: { message: 'code "SAVE10" already exists' } });
  });

  it("maps a CastError to 400 naming the path", () => {
    const err = new mongoose.Error.CastError("ObjectId", "nope", "_id");
    expect(handle(err)).toMatchObject({ statusCode: 400, body: { message: "Invalid _id: nope" } });
  });

  it("maps a Mongoose ValidationError to 400 joining every field message", () => {
    const doc = new (mongoose.model("ErrTest", new mongoose.Schema({ a: { type: String, required: true }, b: { type: Number, min: 1 } })))({ b: 0 });
    const err = doc.validateSync();
    const res = handle(err);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/Path `a` is required/);
    expect(res.body.message).toMatch(/b/);
  });

  it("maps a TenancyError to 400 TENANT_CONTEXT_REQUIRED", () => {
    const err = Object.assign(new Error("No tenant context for Product.find"), { name: "TenancyError" });
    expect(handle(err)).toMatchObject({ statusCode: 400, body: { code: "TENANT_CONTEXT_REQUIRED", message: "This request must identify a store" } });
  });

  it("answers an unexpected error with a generic 500 and no internals", () => {
    const res = handle(new TypeError("Cannot read properties of undefined (reading 'secret')"));
    expect(res.statusCode).toBe(500);
    // Same envelope as every other error (BUG-075)
    expect(res.body).toEqual({ statusCode: 500, message: "Something went wrong , please try agin later !!" });
  });

  it.each(["production", "test", "staging"])("never returns a stack trace when NODE_ENV is %s", (env) => {
    const res = handle(new customError("x", 400), env);
    expect(JSON.stringify(res.body)).not.toMatch(/errorStack|at .*\.js/);
  });

  // BUG-063: nodeEnv() defaults an unset NODE_ENV to "development", so a
  // deployment that forgets to set it returns stack traces to every client
  it("never returns a stack trace when NODE_ENV is not set at all [BUG-063]", () => {
    const res = handle(new customError("x", 400), "UNSET");
    expect(JSON.stringify(res.body)).not.toMatch(/errorStack/);
  });

  it("includes the stack only in development (either spelling)", () => {
    for (const env of ["development", "developement"]) {
      const res = handle(new customError("x", 400), env);
      expect(res.body.errorStack).toMatch(/CustomError|errorHandler/);
    }
  });

  // BUG-001: a Joi ValidationError (validateAsync without a catch) has
  // `details`, not `errors`, so it is not recognised and answers 500
  test.failing("maps a Joi ValidationError to 400 with Joi's message [BUG-001]", async () => {
    let err;
    try {
      await Joi.object({ name: Joi.string().required() }).validateAsync({});
    } catch (e) {
      err = e;
    }
    const res = handle(err);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/name/);
  });
});
