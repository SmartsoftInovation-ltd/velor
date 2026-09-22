const mongoose = require("mongoose");
const { connectTestDb, clearTestDb, disconnectTestDb } = require("../helpers/db");
const { runForTenant } = require("../../src/tenancy/context");
const CrateTransaction = require("../../src/models/crateTransaction.model");
const { MANUAL_ENTRY_ONLY } = require("../../src/controller/createTransition.controller");

// /transaction-list is the ledger for entries typed by hand on /add-transaction.
// Sales, purchases, returns and customer/supplier payments all write into the
// same collection, each tagging its row with the reference that lets the
// originating record reverse it later. Those rows belong to their own module's
// list, not here — so every reference field has to be in the filter. A field
// left out (purchaseReturnReference was) leaks that module's rows into the list.
describe("manual transaction ledger filter", () => {
  const tenantId = new mongoose.Types.ObjectId();

  beforeAll(connectTestDb);
  afterEach(clearTestDb);
  afterAll(disconnectTestDb);

  const REFERENCE_FIELDS = [
    "saleReference",
    "supplierPaymentReference",
    "customerPaymentReference",
    "customerAdvancePaymentReference",
    "purchaseReference",
    "salesReturnReference",
    "purchaseReturnReference",
  ];

  const create = (extra) =>
    runForTenant(tenantId, () =>
      CrateTransaction.create({
        date: new Date(),
        account: new mongoose.Types.ObjectId(),
        transactionType: "cash payment",
        amount: 100,
        ...extra,
      }),
    );

  const listed = () =>
    runForTenant(tenantId, () =>
      CrateTransaction.find(MANUAL_ENTRY_ONLY).select("transactionDescription").lean(),
    );

  it("lists an entry typed by hand", async () => {
    await create({ transactionDescription: "typed by hand" });

    const rows = await listed();
    expect(rows).toHaveLength(1);
    expect(rows[0].transactionDescription).toBe("typed by hand");
  });

  // Every module that writes a transaction must be filtered out, not just the
  // ones that existed when the list was written.
  it.each(REFERENCE_FIELDS)("hides a row tagged with %s", async (field) => {
    await create({
      transactionDescription: `auto-generated via ${field}`,
      [field]: new mongoose.Types.ObjectId(),
    });

    expect(await listed()).toHaveLength(0);
  });

  it("keeps the manual entry when auto-generated rows sit beside it", async () => {
    await create({ transactionDescription: "typed by hand" });
    for (const field of REFERENCE_FIELDS) {
      await create({ transactionDescription: field, [field]: new mongoose.Types.ObjectId() });
    }

    const rows = await listed();
    expect(rows).toHaveLength(1);
    expect(rows[0].transactionDescription).toBe("typed by hand");
  });

  // The filter is only as complete as the schema: a reference field added to
  // the model later has to be added here too, or its module's rows leak in.
  it("covers every reference field the transaction schema defines", () => {
    const schemaRefs = Object.keys(CrateTransaction.schema.paths).filter((p) =>
      p.endsWith("Reference"),
    );
    expect(schemaRefs.sort()).toEqual(REFERENCE_FIELDS.sort());
    expect(Object.keys(MANUAL_ENTRY_ONLY).sort()).toEqual(REFERENCE_FIELDS.sort());
  });
});
