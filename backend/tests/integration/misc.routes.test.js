const nock = require("nock");
const mongoose = require("mongoose");
const { useIntegrationApp } = require("../setup/integration");
const { api } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const SmsLog = require("../../src/models/smsLog.model");
const Employee = require("../../src/models/employee.model");
const DeliveryCharge = require("../../src/models/delivery.model");
const { auditLogModel } = require("../../src/models/auditLog.model");
const settings = require("../../src/settings/settings.service");

const GATEWAY = "http://sms-gateway.example.test";

describe("SMS, employees, delivery charges and the audit log", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect(/127\.0\.0\.1|localhost/);
  });
  afterAll(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "miscshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
  });
  afterEach(() => nock.cleanAll());

  const as = () => api(ctx.server, { token: tokenFor(owner), tenant: "miscshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);

  describe("due SMS (/sms)", () => {
    beforeEach(async () => {
      await settings.updateSection(tenant._id, "sms", { enabled: true, apiUrl: `${GATEWAY}/api/smsapi`, apiKey: "dummy-sms-key", senderId: "SHOP" }, { allowReadOnly: true });
      settings.clearSettingsCache();
    });

    it("sends one due SMS through the store's gateway and logs it", async () => {
      const customer = await f.customer.create({ mobileNumber: "01912345678", openingDues: 500 });
      let sent;
      nock(GATEWAY).post("/api/smsapi", (b) => (sent = b)).reply(200, { response_code: 202 });
      const res = await as().post(`/sms/due-sms/send/${customer._id}`).send({ message: "You owe 500" }).expect(200);
      expect(sent).toMatchObject({ number: "01912345678", message: "You owe 500", senderid: "SHOP" });
      const log = await inTenant(() => SmsLog.findById(res.body.data.logId).lean());
      expect(log).toMatchObject({ status: "completed", sentCount: 1 });
      await as().get(`/sms/due-sms/logs/${res.body.data.logId}`).expect(200);
    });

    it("caps a typed message at one SMS: 160 English characters, 70 with Bangla", async () => {
      let sent;
      nock(GATEWAY).post("/api/smsapi", (b) => (sent = b)).reply(200, { response_code: 202 });
      await as().post("/sms/send-sms").send({ phoneNumber: "01912345678", message: "a".repeat(160) }).expect(200);
      expect(sent.message).toHaveLength(160);

      const tooLong = await as().post("/sms/send-sms").send({ phoneNumber: "01912345678", message: "a".repeat(161) }).expect(400);
      expect(tooLong.body.message).toContain("161/160");
      // "{" goes out as two GSM characters
      await as().post("/sms/send-sms").send({ phoneNumber: "01912345678", message: "{".repeat(81) }).expect(400);
      await as().post("/sms/send-sms").send({ phoneNumber: "01912345678", message: "অ".repeat(71) }).expect(400);
      await as().post("/sms/bulk-sms").send({ phoneNumber: ["01912345678"], message: "অ".repeat(71) }).expect(400);
      await as().post("/sms/bulk-sms/send").send({ recipientType: "logged", message: "a".repeat(161) }).expect(400);
      // The due-SMS sends obey the same one-SMS limit as every other send
      const customer = await f.customer.create();
      await as().post(`/sms/due-sms/send/${customer._id}`).send({ message: "a".repeat(161) }).expect(400);
      await as().post("/sms/due-sms/send-all").send({ message: "অ".repeat(71) }).expect(400);
    });

    it("400 without a message; 404 for an unknown customer; 400 for an inactive one", async () => {
      const customer = await f.customer.create({ isActive: false });
      await as().post(`/sms/due-sms/send/${customer._id}`).send({}).expect(400);
      await as().post(`/sms/due-sms/send/${new mongoose.Types.ObjectId()}`).send({ message: "x" }).expect(404);
      await as().post(`/sms/due-sms/send/${customer._id}`).send({ message: "x" }).expect(400);
    });

    it("bulk due SMS to every active customer is queued for the worker, stamped with the store", async () => {
      await f.customer.create({ mobileNumber: "01911111111" });
      await f.customer.create({ mobileNumber: "01922222222" });
      await f.customer.create({ mobileNumber: "01933333333", isActive: false });
      const res = await as().post("/sms/due-sms/send-all").send({ message: "Please pay" }).expect(201);
      expect(res.body.data).toMatchObject({ totalCount: 2, status: "queued" });
      const { smsQueue } = require("../../src/queues/sms.queue");
      const job = await smsQueue.getJob(res.body.data.jobId);
      expect(job.data.tenantId).toBe(tenant._id.toString());
      expect(job.data.recipients.map((r) => r.phone).sort()).toEqual(["01911111111", "01922222222"]);
      const logs = await as().get("/sms/due-sms/logs").expect(200);
      expect(JSON.stringify(logs.body.data)).toContain(String(res.body.data.logId));
    });

    it("SMS_NOT_CONFIGURED when the store has not set up SMS (no fallback to another account)", async () => {
      await settings.updateSection(tenant._id, "sms", { enabled: false });
      settings.clearSettingsCache();
      const customer = await f.customer.create();
      const res = await as().post(`/sms/due-sms/send/${customer._id}`).send({ message: "x" });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("SMS_NOT_CONFIGURED");
    });
  });

  describe("employees (/employee)", () => {
    it("creates (id assigned server-side), lists, soft deletes and restores", async () => {
      const designation = await as().post("/employee/create-employee-designation").send({ name: "Cashier" }).expect(201);
      const designationId = designation.body.data._id || designation.body.data.id;
      const res = await as().post("/employee/create-employee").send({ fullName: "Karim Mia", gender: "male", mobile: "01811110000", designation: designationId });
      expect(res.status).toBe(201);
      const emp = await inTenant(() => Employee.findOne({ fullName: "Karim Mia" }).lean());
      expect(emp.employeeId).toBeTruthy();
      await as().get("/employee/get-employee").expect(200);
      await as().delete(`/employee/delete-employee-soft/${emp.employeeId}`).expect(200);
      expect((await inTenant(() => Employee.findById(emp._id).lean())).isActive).toBe(false);
      await as().put(`/employee/restore-employee/${emp.employeeId}`).expect(200);
      expect((await inTenant(() => Employee.findById(emp._id).lean())).isActive).toBe(true);
    });

    it("400 for a missing name, an unknown gender, or a client-chosen employeeId", async () => {
      await as().post("/employee/create-employee").send({ gender: "male" }).expect(400);
      await as().post("/employee/create-employee").send({ fullName: "X Y", gender: "robot" }).expect(400);
      await as().post("/employee/create-employee").send({ fullName: "X Y", gender: "male", employeeId: "E-1" }).expect(400);
    });
  });

  describe("delivery charges (/delivery-charge)", () => {
    it("creates, lists, reads, updates and deletes", async () => {
      await as().post("/delivery-charge/create-delivery-charge").send({ name: "Inside Dhaka", deliveryCharge: 60 }).expect(201);
      const dc = await inTenant(() => DeliveryCharge.findOne().lean());
      await as().get("/delivery-charge/get-delivery-charge").expect(200);
      await as().get(`/delivery-charge/get-single-delivery-charge/${dc._id}`).expect(200);
      await as().put(`/delivery-charge/update-delivery-charge/${dc._id}`).send({ deliveryCharge: 80 }).expect(200);
      expect((await inTenant(() => DeliveryCharge.findById(dc._id).lean())).deliveryCharge).toBe(80);
      await as().delete(`/delivery-charge/delete-delivery-charge/${dc._id}`).expect(200);
      expect(await inTenant(() => DeliveryCharge.countDocuments())).toBe(0);
    });
  });

  describe("audit log (/audit)", () => {
    it("lists this store's entries only, and an entity's timeline", async () => {
      const entityId = new mongoose.Types.ObjectId();
      const other = await tenantFactory.create();
      const row = (tenantId, label) => ({ tenantId, action: "CREATE", entity: { type: "product", id: entityId, label }, createdAt: new Date() });
      await auditLogModel.collection.insertMany([row(tenant._id, "MINE"), row(other._id, "FOREIGN")]);
      const list = await as().get("/audit").expect(200);
      expect(JSON.stringify(list.body.data)).toContain("MINE");
      expect(JSON.stringify(list.body.data)).not.toContain("FOREIGN");
      const timeline = await as().get(`/audit/entity/product/${entityId}`).expect(200);
      expect(JSON.stringify(timeline.body.data)).not.toContain("FOREIGN");
    });
  });
});
