const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { setSettingsEnv } = require("../helpers/settings");
const { runForTenant } = require("../../src/tenancy/context");
const service = require("../../src/settings/settings.service");
const { SupplierModel: Supplier } = require("../../src/models/supplier.model");

const A = new mongoose.Types.ObjectId();
const B = new mongoose.Types.ObjectId();

describe("serial numbers use the tenant invoice prefix and per-tenant counters", () => {
  const envBackup = { ...process.env };

  beforeAll(async () => {
    setSettingsEnv();
    await connectTestDb();
    service.setSettingsPublisher(async () => {});
  });
  beforeEach(() => service.clearSettingsCache());
  afterEach(clearTestDb);
  afterAll(async () => {
    process.env = { ...envBackup };
    await disconnectTestDb();
  });

  const createSupplier = (tenantId, mobile) =>
    runForTenant(tenantId, () => Supplier.create({ supplierName: "Rahim Traders", mobile }));

  it("formats serials with each tenant's prefix, each tenant counting from 1", async () => {
    await service.updateSection(A, "general", { invoicePrefix: "PZS" });
    await service.updateSection(B, "general", { invoicePrefix: "BRG" });

    const a1 = await createSupplier(A, "01711000001");
    const a2 = await createSupplier(A, "01711000002");
    const b1 = await createSupplier(B, "01711000003");

    expect(a1.supplierSerialId).toBe("SUPL-PZS-01");
    expect(a2.supplierSerialId).toBe("SUPL-PZS-02");
    expect(b1.supplierSerialId).toBe("SUPL-BRG-01");
  });

  // The prefix is a store setting; there is no env fallback that would stamp one
  // store's serial format onto another's documents.
  it("refuses to build a serial without a tenant context", async () => {
    process.env.INVOICE_PREFIX = "VLR";
    await expect(
      Supplier.create({ supplierName: "Legacy Traders", mobile: "01711000009" }),
    ).rejects.toMatchObject({ name: "TenancyError" });
  });
});
