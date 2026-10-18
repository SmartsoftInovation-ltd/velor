const { useIntegrationApp } = require("../setup/integration");
const { api, expectErrorEnvelope } = require("../helpers/api");
const { createUserIn, tokenFor } = require("../helpers/auth");
const { tenantFactory, forTenant } = require("../factories");
const { runForTenant } = require("../../src/tenancy/context");
const Account = require("../../src/models/account.model");
const CrateTransaction = require("../../src/models/crateTransaction.model");
const MoneyTransfer = require("../../src/models/moneyTransfer.model");
const FundHandover = require("../../src/models/fundHandoverDescription.model");
const { MANUAL_ENTRY_ONLY } = require("../../src/controller/createTransition.controller");

describe("finance routes: accounts, transactions, categories, money transfer, fund handover", () => {
  const ctx = useIntegrationApp();
  let tenant;
  let f;
  let owner;

  beforeEach(async () => {
    tenant = await tenantFactory.create({ slug: "moneyshop" });
    f = forTenant(tenant);
    owner = await createUserIn(tenant, { owner: true });
  });

  const as = (user = owner) => api(ctx.server, { token: tokenFor(user), tenant: "moneyshop" });
  const inTenant = (fn) => runForTenant(tenant._id, fn);
  const balanceOf = async (account) => (await inTenant(() => Account.findById(account._id).lean())).balance;
  const today = new Date().toISOString().slice(0, 10);

  const category = async (allowedType = "cash payment", name = `Cat ${Math.random()}`) =>
    (await as().post("/transaction-category/create-transaction-category").send({ categories: [{ name, allowedType }] }).expect(200)).body.data[0];

  describe("accounts (/account)", () => {
    it("creates several accounts at once, skipping duplicates; lists, searches, paginates", async () => {
      const res = await as().post("/account/create-account").send({ accounts: ["Cash", "Bank", "Cash"] }).expect(200);
      expect(res.body.data.map((a) => a.name)).toEqual(["Cash", "Bank"]);
      const list = await as().get("/account/all-account").query({ search: "ban" }).expect(200);
      expect(list.body.data.accounts.map((a) => a.name)).toEqual(["Bank"]);
      const paged = await as().get("/account/all-account").query({ page: 2, limit: 1 }).expect(200);
      expect(paged.body.data).toMatchObject({ total: 2, page: 2, hasNextPage: false });
      await as().post("/account/create-account").send({ accounts: [] }).expect(400);
      const regex = await as().get("/account/all-account").query({ search: ".*" }).expect(200);
      expect(regex.body.data.accounts).toEqual([]);
    });

    it("reads by slug, renames (slug follows), deletes; 404s for unknown slugs and other stores", async () => {
      await as().post("/account/create-account").send({ accounts: ["Petty Cash"] }).expect(200);
      await as().get("/account/single-account/petty-cash").expect(200);
      await as().put("/account/update-account/petty-cash").send({ name: "Office Cash" }).expect(200);
      await as().get("/account/single-account/office-cash").expect(200);
      const other = await tenantFactory.create({ slug: "moneyother" });
      const rival = await createUserIn(other, { owner: true });
      await api(ctx.server, { token: tokenFor(rival), tenant: "moneyother" }).delete("/account/delete-account/office-cash").expect(404);
      await as().delete("/account/delete-account/office-cash").expect(200);
      await as().get("/account/single-account/office-cash").expect(404);
    });

    // BUG-056: update spreads req.body into the account, so its balance can be
    // set to any figure without a transaction behind it
    test.failing("an account update cannot set the balance directly [BUG-056]", async () => {
      const account = await f.account.create({ name: "Vault", balance: 1000 });
      await as().put(`/account/update-account/${account.slug}`).send({ name: "Vault", balance: 999999 }).expect(200);
      expect(await balanceOf(account)).toBe(1000);
    });
  });

  describe("manual transactions (/transaction)", () => {
    it("a payment lowers and a receipt raises the account balance, with balanceAfter recorded", async () => {
      const account = await f.account.create({ balance: 1000 });
      const pay = await category("cash payment");
      const recv = await category("cash recived");
      const out = await as()
        .post("/transaction/create-transaction")
        .send({ date: today, transactionCategory: pay._id, account: account._id.toString(), transactionType: "cash payment", amount: 300, transactionDescription: "Rent" })
        .expect(201);
      expect(out.body.data.balanceAfter).toBe(700);
      await as()
        .post("/transaction/create-transaction")
        .send({ date: today, transactionCategory: recv._id, account: account._id.toString(), transactionType: "cash recived", amount: 50, transactionDescription: "Scrap" })
        .expect(201);
      expect(await balanceOf(account)).toBe(750);
    });

    it("400 when the type does not match the category, or a field is missing; 404 for unknown category/account", async () => {
      const account = await f.account.create({ balance: 1000 });
      const pay = await category("cash payment");
      const body = { date: today, transactionCategory: pay._id, account: account._id.toString(), transactionType: "cash payment", amount: 10, transactionDescription: "x" };
      const mismatch = await as().post("/transaction/create-transaction").send({ ...body, transactionType: "cash recived" }).expect(400);
      expect(mismatch.body.message).toMatch(/only allows/);
      await as().post("/transaction/create-transaction").send({ ...body, amount: undefined }).expect(400);
      await as().post("/transaction/create-transaction").send({ ...body, transactionCategory: "0123456789abcdef01234567" }).expect(404);
      await as().post("/transaction/create-transaction").send({ ...body, account: "0123456789abcdef01234567" }).expect(404);
      expect(await balanceOf(account)).toBe(1000);
    });

    // BUG-057: the balance is $inc'd before the transaction row is written,
    // with no session: a row that then fails validation leaves the money moved
    test.failing("a transaction that fails to save leaves the balance untouched [BUG-057]", async () => {
      const account = await f.account.create({ balance: 1000 });
      const pay = await category("cash payment");
      const res = await as()
        .post("/transaction/create-transaction")
        .send({ date: "not-a-date", transactionCategory: pay._id, account: account._id.toString(), transactionType: "cash payment", amount: 300, transactionDescription: "x" });
      expect(res.status).toBe(400);
      expect(await balanceOf(account)).toBe(1000);
    });

    // BUG-057 (same root): a negative amount is accepted and inverts the transaction's direction
    test.failing("refuses a negative amount [BUG-057]", async () => {
      const account = await f.account.create({ balance: 1000 });
      const pay = await category("cash payment");
      const res = await as()
        .post("/transaction/create-transaction")
        .send({ date: today, transactionCategory: pay._id, account: account._id.toString(), transactionType: "cash payment", amount: -500, transactionDescription: "x" });
      expect(res.status).toBe(400);
      expect(await balanceOf(account)).toBe(1000);
    });

    it("update re-applies the amount (and can move it to another account); delete reverses it", async () => {
      const a = await f.account.create({ balance: 1000 });
      const b = await f.account.create({ balance: 0 });
      const pay = await category("cash payment");
      const created = (
        await as().post("/transaction/create-transaction").send({ date: today, transactionCategory: pay._id, account: a._id.toString(), transactionType: "cash payment", amount: 100, transactionDescription: "x" }).expect(201)
      ).body.data;
      await as().put(`/transaction/update-transaction/${created._id}`).send({ amount: 250 }).expect(200);
      expect(await balanceOf(a)).toBe(750);
      await as().put(`/transaction/update-transaction/${created._id}`).send({ account: b._id.toString() }).expect(200);
      expect(await balanceOf(a)).toBe(1000);
      expect(await balanceOf(b)).toBe(-250);
      await as().delete(`/transaction/delete-transaction/${created._id}`).expect(200);
      expect(await balanceOf(b)).toBe(0);
      await as().delete(`/transaction/delete-transaction/${created._id}`).expect(404);
    });

    it("lists only hand-typed entries; rows created by sales/purchases cannot be edited or deleted here", async () => {
      const account = await f.account.create({ balance: 0 });
      const auto = await inTenant(() => CrateTransaction.create({ account: account._id, amount: 99, transactionType: "cash recived", saleReference: account._id }));
      const pay = await category("cash payment");
      await as().post("/transaction/create-transaction").send({ date: today, transactionCategory: pay._id, account: account._id.toString(), transactionType: "cash payment", amount: 5, transactionDescription: "manual" }).expect(201);
      const list = await as().get("/transaction/get-alltransaction").expect(200);
      expect(list.body.data.transactions.map((t) => t.transactionDescription)).toEqual(["manual"]);
      await as().delete(`/transaction/delete-transaction/${auto._id}`).expect(404);
      await as().put(`/transaction/update-transaction/${auto._id}`).send({ amount: 1 }).expect(404);
      const history = await as().get(`/transaction/account-transaction/${account._id}`).expect(200);
      expect(history.body.data.transactions).toHaveLength(2);
    });

    it("the manual-entry filter names every reference field the transaction schema has", () => {
      const refs = Object.keys(CrateTransaction.schema.paths).filter((p) => p.endsWith("Reference"));
      expect(Object.keys(MANUAL_ENTRY_ONLY).sort()).toEqual(refs.sort());
    });
  });

  describe("transaction categories (/transaction-category)", () => {
    it("400 for a bad allowedType; reads, renames and deletes by slug", async () => {
      await as().post("/transaction-category/create-transaction-category").send({ categories: [{ name: "Bad", allowedType: "gift" }] }).expect(400);
      await as().post("/transaction-category/create-transaction-category").send({}).expect(400);
      const created = await category("cash payment", "Utilities");
      await as().get(`/transaction-category/single-transition-category/${created.slug}`).expect(200);
      await as().put(`/transaction-category/update-transition-category/${created.slug}`).send({ name: "Power Bills" }).expect(200);
      const list = await as().get("/transaction-category/all-transition-category").expect(200);
      expect(list.body.data.categories.map((c) => c.name)).toContain("Power Bills");
    });
  });

  describe("money transfer (/moneytransfer)", () => {
    const transfer = (from, to, extra = {}) =>
      as().post("/moneytransfer/create-moneytransfer").send({ date: today, fromAccount: from._id.toString(), toAccount: to._id.toString(), amount: 400, transactionDesction: "Float", ...extra });

    it("records a transfer with a serial; lists, reads and deletes it", async () => {
      const a = await f.account.create({ balance: 1000 });
      const b = await f.account.create({ balance: 0 });
      const created = (await transfer(a, b).expect(201)).body.data;
      const stored = await inTenant(() => MoneyTransfer.findById(created._id).lean());
      expect(stored.transferSerialId).toBe("MTRF-INV-01");
      const list = await as().get("/moneytransfer/all-moneytransfer").expect(200);
      expect(list.body.data.total).toBe(1);
      await as().get(`/moneytransfer/single-moneytransfer/${created._id}`).expect(200);
      await as().delete(`/moneytransfer/delete-moneytransfer/${created._id}`).expect(200);
      await as().get(`/moneytransfer/single-moneytransfer/${created._id}`).expect(404);
    });

    it("400 without from/to/amount, and for a negative amount", async () => {
      const a = await f.account.create();
      await as().post("/moneytransfer/create-moneytransfer").send({ fromAccount: a._id.toString(), amount: 5 }).expect(400);
      const res = await transfer(a, a, { amount: -1 });
      expect(res.status).toBe(400);
      expectErrorEnvelope(res.body, 400);
    });

    // BUG-058: a transfer is only a record — neither account's balance moves,
    // and nothing is written to the ledger, so balances and reports ignore it
    test.failing("moves the amount from one account to the other [BUG-058]", async () => {
      const a = await f.account.create({ balance: 1000 });
      const b = await f.account.create({ balance: 0 });
      await transfer(a, b).expect(201);
      expect(await balanceOf(a)).toBe(600);
      expect(await balanceOf(b)).toBe(400);
    });

    test.failing("refuses a transfer to the same account or from an unknown one [BUG-058]", async () => {
      const a = await f.account.create({ balance: 1000 });
      await transfer(a, a).expect(400);
      await transfer({ _id: "0123456789abcdef01234567" }, a).expect(404);
    });

    // BUG-059: the controller sends `date`, the schema field is `Date`, so the
    // transfer date the user picked is silently dropped
    test.failing("keeps the transfer date [BUG-059]", async () => {
      const a = await f.account.create();
      const b = await f.account.create();
      const created = (await transfer(a, b, { date: "2026-03-15" }).expect(201)).body.data;
      const stored = await inTenant(() => MoneyTransfer.findById(created._id).lean());
      const saved = stored.date ?? stored.Date;
      expect(saved).toBeDefined();
      expect(new Date(saved).toISOString().slice(0, 10)).toBe("2026-03-15");
    });
  });

  describe("fund handover (/fundhandover)", () => {
    it("creates with a serial, lists, reads and deletes; 400 without required fields", async () => {
      const account = await f.account.create();
      await as().post("/fundhandover/create-fundhandover").send({ name: "Owner" }).expect(400);
      const created = (
        await as().post("/fundhandover/create-fundhandover").send({ date: today, transactionDescription: "Cash To Owner", name: "Owner", fundPaymentMode: account._id.toString(), amount: 500 }).expect(201)
      ).body.data;
      const stored = await inTenant(() => FundHandover.findById(created._id).lean());
      expect(stored.transactionDescription).toBe("cash to owner"); // schema lowercases it
      expect(stored.handoverSerialId).toMatch(/INV/);
      await as().get("/fundhandover/getall-fundhandover").expect(200);
      await as().get(`/fundhandover/single-fundhandover/${created._id}`).expect(200);
      await as().delete(`/fundhandover/delete-fundhandover/${created._id}`).expect(200);
      await as().get(`/fundhandover/single-fundhandover/${created._id}`).expect(404);
    });
  });
});
